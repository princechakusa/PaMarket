import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { color, font, radius, space, type ColorPalette } from "../../lib/theme";
import { useThemedStyles } from "../../lib/theme-provider";
import { useIOSNativeHeader } from "../../lib/useIOSNativeHeader";
import {
  AVAILABILITY_OPTIONS,
  JOB_CATEGORIES,
  LANGUAGE_PROFICIENCY,
  SALARY_CURRENCIES,
  type CvCertification,
  type CvEducation,
  type CvExperience,
  type CvLanguage,
  type CvPortfolioItem,
  type JobSeekerCv,
} from "../../lib/jobs";
import { uploadImageUriToR2 } from "../../lib/uploadToR2";
import {
  ALLOWED_CV_MIME_TYPES,
  CV_VALIDATION_ERROR,
  MAX_CV_SIZE_BYTES,
  getCvSignedUrl,
  openCvUrl,
  randomCvFileName,
} from "../../lib/cv";
import { Avatar, Button, Card, Chip, GlassBackButton, SectionHeader } from "../../components/ui";
import { toast } from "../../components/ui/Toast";

// Mirrors www/js/jobs.js CandidateProfile ("Get Hired" CV builder). The flat
// profile columns (job_title, skills, sector, exp, city, open_to_work,
// expected_salary, cv_file_path) are the source of truth; profiles.cv jsonb is
// an enriched structured snapshot (experience/education/certifications/
// languages/portfolio) that only lives in the jsonb — there are no flat
// columns for those, per supabase/schema/profiles.sql.
//
// CV FILE: uploaded as a real PDF via expo-document-picker, straight to the
// private cv-files Supabase Storage bucket (owner-scoped RLS), and referenced
// by cv_file_path — an internal object path, never a URL. Viewing it (by the
// candidate themselves, or an authorized employer) goes through the
// get-cv-url Edge Function, which returns a short-lived signed URL after an
// authorization check — see lib/cv.ts.
//
// cv_file_url is unrelated and unaffected: it's an *external* link a
// candidate pastes themselves (e.g. a CV hosted on Google Drive) — never our
// data, never gated, kept exactly as before.

type ProfileRow = {
  id: string;
  avatar: string | null;
  job_title: string | null;
  skills: string | null;
  sector: string | null;
  exp: string | null;
  city: string | null;
  bio: string | null;
  open_to_work: boolean | null;
  expected_salary: string | null;
  cv_file_url: string | null;
  cv_file_path: string | null;
  cv: JobSeekerCv | null;
};

const EXP_LEVELS: Array<[string, string]> = [
  ["entry", "Entry level (0-2 yrs)"],
  ["mid", "Mid level (3-5 yrs)"],
  ["senior", "Senior (5-10 yrs)"],
  ["expert", "Expert (10+ yrs)"],
];

function CameraIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color.textOnBrand} strokeWidth={2}>
      <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <Path d="M12 17a4 4 0 100-8 4 4 0 000 8z" />
    </Svg>
  );
}

function pctId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function CvProfileScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(buildStyles);
  useIOSNativeHeader({ backgroundColor: color.brand, tintColor: color.textOnBrand, title: "My CV / Job Profile" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [cvUploading, setCvUploading] = useState(false);
  const [cvOpening, setCvOpening] = useState(false);

  // Basics / flat mirror
  const [openToWork, setOpenToWork] = useState(false);
  const [availability, setAvailability] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [sector, setSector] = useState("");
  const [exp, setExp] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [expectedSalary, setExpectedSalary] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");

  // Structured (cv jsonb only)
  const [experience, setExperience] = useState<CvExperience[]>([]);
  const [education, setEducation] = useState<CvEducation[]>([]);
  const [certifications, setCertifications] = useState<CvCertification[]>([]);
  const [languages, setLanguages] = useState<CvLanguage[]>([]);
  const [portfolio, setPortfolio] = useState<CvPortfolioItem[]>([]);
  const [cvFileUrl, setCvFileUrl] = useState("");
  const [cvFilePath, setCvFilePath] = useState<string | null>(null);
  // Old object path pending deletion once the new upload + profile save both
  // succeed — never deleted before that, so a failed save never leaves the
  // candidate with no CV on file.
  const [cvPathPendingDelete, setCvPathPendingDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from("profiles")
      .select("id,name,avatar,job_title,skills,sector,exp,city,bio,open_to_work,expected_salary,cv_file_url,cv_file_path,cv")
      .eq("id", session.user.id)
      .maybeSingle();
    const p = data as (ProfileRow & { name: string | null }) | null;
    if (p) {
      const cv = p.cv || {};
      setOpenToWork(!!p.open_to_work);
      setAvailability(cv.availability || "");
      setAvatarUrl(cv.photoUrl || p.avatar || null);
      setFullName(p.name || "");
      setJobTitle(p.job_title || cv.headline || "");
      setSector(p.sector || cv.sector || "");
      setExp(p.exp || cv.exp || "");
      setCity(p.city || cv.location || "");
      // cv.summary is the job-profile's own bio — profiles.bio is a
      // different field entirely (the general marketplace "About" bio
      // edited from edit-profile.tsx). Reading/writing profiles.bio here
      // was showing the marketplace bio inside the job profile, and saving
      // this screen silently overwrote the marketplace bio with whatever
      // was typed here.
      setBio(cv.summary || "");
      setExpectedSalary(p.expected_salary || cv.expectedSalary || "");
      setCurrency(cv.currency || "USD");
      setSkills(cv.skills?.length ? cv.skills : (p.skills || "").split(",").map((s) => s.trim()).filter(Boolean));
      setExperience(cv.experience || []);
      setEducation(cv.education || []);
      setCertifications(cv.certifications || []);
      setLanguages(cv.languages || []);
      setPortfolio(cv.portfolio || []);
      setCvFileUrl(p.cv_file_url || cv.cvFileUrl || "");
      setCvFilePath(p.cv_file_path || cv.cvFilePath || null);
    }
  }, [session?.user]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  function addSkill() {
    const s = skillInput.trim();
    if (!s) return;
    if (!skills.some((x) => x.toLowerCase() === s.toLowerCase())) setSkills([...skills, s]);
    setSkillInput("");
  }

  async function pickAndUploadPhoto() {
    if (!session?.user) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setPhotoUploading(true);
    try {
      const key = `cv/${session.user.id}/photo-${Date.now()}.jpg`;
      const url = await uploadImageUriToR2(result.assets[0].uri, key);
      setAvatarUrl(url);
      toast("Photo updated");
    } catch {
      toast("Upload failed, please try again");
    } finally {
      setPhotoUploading(false);
    }
  }

  // CVs go to the PRIVATE cv-files Supabase Storage bucket, uploaded
  // directly with the candidate's own authenticated session — RLS on that
  // bucket only allows writing under {auth.uid()}/, so a client can never
  // upload into another user's folder even if it tried. Only the resulting
  // object path (never a public URL) is stored.
  async function pickAndUploadCv() {
    if (!session?.user) return;
    const result = await DocumentPicker.getDocumentAsync({
      type: ALLOWED_CV_MIME_TYPES,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    const mime = asset.mimeType || "";
    if (!ALLOWED_CV_MIME_TYPES.includes(mime)) {
      toast(CV_VALIDATION_ERROR);
      return;
    }
    if (typeof asset.size === "number" && asset.size > MAX_CV_SIZE_BYTES) {
      toast(CV_VALIDATION_ERROR);
      return;
    }

    setCvUploading(true);
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      if (blob.size > MAX_CV_SIZE_BYTES) {
        toast(CV_VALIDATION_ERROR);
        return;
      }
      const path = `${session.user.id}/${randomCvFileName(mime)}`;
      const { error } = await supabase.storage.from("cv-files").upload(path, blob, {
        contentType: mime,
        upsert: false,
      });
      if (error) throw error;

      // Defer deleting the previous object until the profile save below
      // actually succeeds — never lose the old CV on a failed save.
      if (cvFilePath) setCvPathPendingDelete(cvFilePath);
      setCvFilePath(path);
      toast("CV uploaded");
    } catch {
      toast("Upload failed, please try again");
    } finally {
      setCvUploading(false);
    }
  }

  function removeCv() {
    if (cvFilePath) setCvPathPendingDelete(cvFilePath);
    setCvFilePath(null);
  }

  async function viewMyCv() {
    setCvOpening(true);
    try {
      const result = await getCvSignedUrl();
      if (!result.ok) {
        toast(result.reason === "no_cv" ? "No CV uploaded." : "Could not open your CV. Please try again.");
        return;
      }
      const opened = await openCvUrl(result.url);
      if (!opened) toast("Could not open your CV. Please try again.");
    } finally {
      setCvOpening(false);
    }
  }

  async function save() {
    if (!session?.user) return;
    if (!jobTitle.trim()) {
      toast("Add your professional title");
      return;
    }
    if (!sector.trim()) {
      toast("Choose a category");
      return;
    }
    if (!city.trim()) {
      toast("Add your city");
      return;
    }
    setIsSaving(true);
    const cleanExperience = experience.filter((e) => (e.title || e.company || e.desc || "").trim());
    const cleanEducation = education.filter((e) => (e.school || e.degree || "").trim());
    const cleanCerts = certifications.filter((c) => (c.name || "").trim());
    const cleanLangs = languages.filter((l) => (l.language || "").trim());
    const cleanPortfolio = portfolio.filter((p) => (p.url || "").trim());

    const cv: JobSeekerCv = {
      headline: jobTitle.trim(),
      location: city.trim(),
      summary: bio.trim(),
      skills,
      expectedSalary: expectedSalary.trim(),
      currency,
      sector: sector.trim(),
      exp,
      availability,
      visible: openToWork,
      photoUrl: avatarUrl || undefined,
      experience: cleanExperience,
      education: cleanEducation,
      certifications: cleanCerts,
      languages: cleanLangs,
      portfolio: cleanPortfolio,
      cvFileUrl: cvFileUrl.trim() || undefined,
      cvFilePath: cvFilePath || undefined,
    };

    const { error } = await supabase
      .from("profiles")
      .update({
        open_to_work: openToWork,
        job_title: jobTitle.trim(),
        sector: sector.trim(),
        exp,
        city: city.trim(),
        expected_salary: expectedSalary.trim(),
        skills: skills.join(","),
        cv_file_url: cvFileUrl.trim() || null,
        cv_file_path: cvFilePath,
        cv,
      })
      .eq("id", session.user.id);
    setIsSaving(false);
    if (error) {
      toast("Could not save your profile");
      return;
    }

    // Only remove the old CV object now that the new path is durably saved
    // — a failed save above left cvFilePath/cvPathPendingDelete untouched,
    // so nothing is deleted unless the swap actually took effect.
    if (cvPathPendingDelete) {
      await supabase.storage.from("cv-files").remove([cvPathPendingDelete]).catch(() => {});
      setCvPathPendingDelete(null);
    }

    toast(openToWork ? "Profile saved — employers can now find you!" : "Profile saved");
    router.back();
  }

  return (
    <View style={styles.container}>
      {Platform.OS !== "ios" ? (
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <GlassBackButton onPress={() => router.back()} tone="light" flat />
          <Text style={styles.headerTitle}>My CV / Job Profile</Text>
          <View style={{ width: 20 }} />
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={color.brand} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Identity header ─────────────────────────────── */}
          <Card style={styles.identityCard}>
            <View style={styles.identityRow}>
              <Pressable onPress={pickAndUploadPhoto} disabled={photoUploading}>
                <Avatar uri={avatarUrl} name={fullName} size={72} ring />
                <View style={styles.photoBadge}>
                  {photoUploading ? <ActivityIndicator color={color.textOnBrand} size="small" /> : <CameraIcon />}
                </View>
              </Pressable>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Input value={fullName} onChangeText={setFullName} placeholder="Full name" style={styles.nameInput}  styles={styles} />
                <Input
                  value={jobTitle}
                  onChangeText={setJobTitle}
                  placeholder="Professional title (e.g. Delivery Driver)"
                  style={styles.titleInput}
                 styles={styles} />
              </View>
            </View>

            <View style={styles.availabilityBlock}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, paddingRight: space.md }}>
                  <Text style={styles.switchTitle}>Open to work</Text>
                  <Text style={styles.switchSub}>Let employers find you in Hire Talent</Text>
                </View>
                <Switch value={openToWork} onValueChange={setOpenToWork} trackColor={{ true: color.brand }} />
              </View>
              <View style={styles.chipsWrap}>
                {AVAILABILITY_OPTIONS.map((a) => (
                  <Chip key={a} label={a} active={availability === a} onPress={() => setAvailability(availability === a ? "" : a)} />
                ))}
              </View>
            </View>
          </Card>

          {/* ── Summary ─────────────────────────────────────── */}
          <SectionRow title="Professional summary"  styles={styles} />
          <Card>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={bio}
              onChangeText={setBio}
              placeholder="A few sentences on your experience, strengths and what you're looking for…"
              placeholderTextColor={color.textMuted}
              multiline
            />
          </Card>

          {/* ── Skills ──────────────────────────────────────── */}
          <SectionRow title="Skills"  styles={styles} />
          <Card>
            <View style={styles.skillAddRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={skillInput}
                onChangeText={setSkillInput}
                placeholder="Add a skill"
                placeholderTextColor={color.textMuted}
                onSubmitEditing={addSkill}
                returnKeyType="done"
              />
              <Button label="Add" size="sm" fullWidth={false} onPress={addSkill} />
            </View>
            {skills.length ? (
              <View style={[styles.chipsWrap, { marginTop: space.md }]}>
                {skills.map((s) => (
                  <Pressable key={s} style={styles.removableChip} onPress={() => setSkills(skills.filter((x) => x !== s))}>
                    <Text style={styles.removableChipText}>{s}</Text>
                    <Text style={styles.removableChipX}>×</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyHint}>No skills yet — add a few to stand out.</Text>
            )}
          </Card>

          {/* ── Experience ──────────────────────────────────── */}
          <SectionRow
            title="Work experience"
            onAdd={() => setExperience([...experience, { title: "", company: "", duration: "", desc: "" }])}
           styles={styles} />
          {experience.length === 0 ? (
            <Card>
              <Text style={styles.emptyHint}>Add roles you've held to build your history.</Text>
            </Card>
          ) : (
            experience.map((e, i) => (
              <Card key={i} style={styles.entryCard}>
                <EntryHeader index={i} onDelete={() => setExperience(experience.filter((_, x) => x !== i))}  styles={styles} />
                <Input value={e.title || ""} onChangeText={(v) => setExperience(patch(experience, i, { title: v }))} placeholder="Job title"  styles={styles} />
                <Input value={e.company || ""} onChangeText={(v) => setExperience(patch(experience, i, { company: v }))} placeholder="Company"  styles={styles} />
                <Input value={e.duration || ""} onChangeText={(v) => setExperience(patch(experience, i, { duration: v }))} placeholder="Period (e.g. Jan 2022 – Present)"  styles={styles} />
                <TextInput
                  style={[styles.input, styles.textareaSm]}
                  value={e.desc || ""}
                  onChangeText={(v) => setExperience(patch(experience, i, { desc: v }))}
                  placeholder="What you did / achievements"
                  placeholderTextColor={color.textMuted}
                  multiline
                />
              </Card>
            ))
          )}

          {/* ── Education ───────────────────────────────────── */}
          <SectionRow title="Education" onAdd={() => setEducation([...education, { school: "", degree: "", year: "" }])}  styles={styles} />
          {education.length === 0 ? (
            <Card>
              <Text style={styles.emptyHint}>Add your qualifications.</Text>
            </Card>
          ) : (
            education.map((e, i) => (
              <Card key={i} style={styles.entryCard}>
                <EntryHeader index={i} onDelete={() => setEducation(education.filter((_, x) => x !== i))}  styles={styles} />
                <Input value={e.school || ""} onChangeText={(v) => setEducation(patch(education, i, { school: v }))} placeholder="Institution"  styles={styles} />
                <Input value={e.degree || ""} onChangeText={(v) => setEducation(patch(education, i, { degree: v }))} placeholder="Qualification"  styles={styles} />
                <Input value={e.year || ""} onChangeText={(v) => setEducation(patch(education, i, { year: v }))} placeholder="Year" last  styles={styles} />
              </Card>
            ))
          )}

          {/* ── Certifications ──────────────────────────────── */}
          <SectionRow title="Certifications" onAdd={() => setCertifications([...certifications, { name: "", issuer: "", year: "" }])}  styles={styles} />
          {certifications.length === 0 ? (
            <Card>
              <Text style={styles.emptyHint}>Licences, certificates and short courses.</Text>
            </Card>
          ) : (
            certifications.map((c, i) => (
              <Card key={i} style={styles.entryCard}>
                <EntryHeader index={i} onDelete={() => setCertifications(certifications.filter((_, x) => x !== i))}  styles={styles} />
                <Input value={c.name || ""} onChangeText={(v) => setCertifications(patch(certifications, i, { name: v }))} placeholder="Certification name"  styles={styles} />
                <Input value={c.issuer || ""} onChangeText={(v) => setCertifications(patch(certifications, i, { issuer: v }))} placeholder="Issuer"  styles={styles} />
                <Input value={c.year || ""} onChangeText={(v) => setCertifications(patch(certifications, i, { year: v }))} placeholder="Year" last  styles={styles} />
              </Card>
            ))
          )}

          {/* ── Languages ───────────────────────────────────── */}
          <SectionRow title="Languages" onAdd={() => setLanguages([...languages, { language: "", proficiency: "Conversational" }])}  styles={styles} />
          {languages.length === 0 ? (
            <Card>
              <Text style={styles.emptyHint}>Which languages do you speak?</Text>
            </Card>
          ) : (
            languages.map((l, i) => (
              <Card key={i} style={styles.entryCard}>
                <EntryHeader index={i} onDelete={() => setLanguages(languages.filter((_, x) => x !== i))}  styles={styles} />
                <Input value={l.language || ""} onChangeText={(v) => setLanguages(patch(languages, i, { language: v }))} placeholder="Language (e.g. Shona)"  styles={styles} />
                <View style={styles.chipsWrap}>
                  {LANGUAGE_PROFICIENCY.map((p) => (
                    <Chip key={p} label={p} active={l.proficiency === p} onPress={() => setLanguages(patch(languages, i, { proficiency: p }))} />
                  ))}
                </View>
              </Card>
            ))
          )}

          {/* ── Portfolio ───────────────────────────────────── */}
          <SectionRow title="Portfolio & links" onAdd={() => setPortfolio([...portfolio, { label: "", url: "" }])}  styles={styles} />
          {portfolio.length === 0 ? (
            <Card>
              <Text style={styles.emptyHint}>Link to work samples, a website or profiles.</Text>
            </Card>
          ) : (
            portfolio.map((p, i) => (
              <Card key={i} style={styles.entryCard}>
                <EntryHeader index={i} onDelete={() => setPortfolio(portfolio.filter((_, x) => x !== i))}  styles={styles} />
                <Input value={p.label || ""} onChangeText={(v) => setPortfolio(patch(portfolio, i, { label: v }))} placeholder="Label (e.g. Portfolio, LinkedIn)"  styles={styles} />
                <Input value={p.url || ""} onChangeText={(v) => setPortfolio(patch(portfolio, i, { url: v }))} placeholder="https://…" last  styles={styles} />
              </Card>
            ))
          )}

          {/* ── CV file ─────────────────────────────────────── */}
          <SectionRow title="CV / Resume file"  styles={styles} />
          <Card>
            {cvFilePath ? (
              <View style={styles.cvFileRow}>
                <Text style={styles.cvFileText} numberOfLines={1}>
                  CV on file (PDF)
                </Text>
                <Pressable onPress={viewMyCv} disabled={cvOpening} hitSlop={8}>
                  <Text style={styles.removeLink}>{cvOpening ? "Opening…" : "View"}</Text>
                </Pressable>
                <Pressable onPress={removeCv} hitSlop={8}>
                  <Text style={styles.removeLink}>Remove</Text>
                </Pressable>
              </View>
            ) : null}
            <Button
              label={cvFilePath ? "Replace CV (PDF)" : "Upload CV (PDF)"}
              variant="secondary"
              loading={cvUploading}
              onPress={pickAndUploadCv}
              style={{ marginBottom: space.md }}
            />
            <Text style={styles.hintText}>PDF only, up to 5 MB. This file is private — only you and employers you apply to can view it.</Text>
            <Text style={[styles.label, styles.spacedLabel]}>Or paste a link (CV hosted elsewhere)</Text>
            <Input value={cvFileUrl} onChangeText={setCvFileUrl} placeholder="https://…" last  styles={styles} />
          </Card>

          {/* ── Preferences ─────────────────────────────────── */}
          <SectionRow title="Job preferences"  styles={styles} />
          <Card>
            <Text style={styles.label}>Category / sector</Text>
            <View style={styles.chipsWrap}>
              {JOB_CATEGORIES.map((c) => (
                <Chip key={c} label={c} active={sector === c} onPress={() => setSector(c)} />
              ))}
            </View>
            <Text style={[styles.label, styles.spacedLabel]}>Experience level</Text>
            <View style={styles.chipsWrap}>
              {EXP_LEVELS.map(([key, lbl]) => (
                <Chip key={key} label={lbl} active={exp === key} onPress={() => setExp(key)} />
              ))}
            </View>
            <View style={styles.spacedLabel}>
              <Input value={city} onChangeText={setCity} placeholder="City (e.g. Harare)"  styles={styles} />
            </View>
            <Text style={styles.label}>Expected salary</Text>
            <View style={styles.salaryRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={expectedSalary}
                onChangeText={setExpectedSalary}
                placeholder="e.g. 500 or Negotiable"
                placeholderTextColor={color.textMuted}
              />
            </View>
            <View style={[styles.chipsWrap, { marginTop: space.md }]}>
              {SALARY_CURRENCIES.map((c) => (
                <Chip key={c} label={c} active={currency === c} onPress={() => setCurrency(c)} />
              ))}
            </View>
          </Card>

          <Button
            label={isSaving ? "Saving…" : "Save CV"}
            variant="gold"
            size="lg"
            loading={isSaving}
            onPress={save}
            style={{ marginTop: space.xl }}
          />
        </ScrollView>
      )}
    </View>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function patch<T>(arr: T[], index: number, changes: Partial<T>): T[] {
  return arr.map((item, i) => (i === index ? { ...item, ...changes } : item));
}

type Styles = ReturnType<typeof buildStyles>;

function SectionRow({ title, onAdd, styles }: { title: string; onAdd?: () => void; styles: Styles }) {
  return (
    <View style={styles.sectionRow}>
      <SectionHeader title={title} actionLabel={onAdd ? "+ Add" : undefined} onAction={onAdd} />
    </View>
  );
}

function EntryHeader({ index, onDelete, styles }: { index: number; onDelete: () => void; styles: Styles }) {
  return (
    <View style={styles.entryHeader}>
      <Text style={styles.entryIndex}>#{index + 1}</Text>
      <Pressable onPress={onDelete} hitSlop={8}>
        <Text style={styles.removeLink}>Delete</Text>
      </Pressable>
    </View>
  );
}

function Input({
  value,
  onChangeText,
  placeholder,
  style,
  last,
  styles,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  style?: object;
  last?: boolean;
  styles: Styles;
}) {
  return (
    <TextInput
      style={[styles.input, !last && { marginBottom: space.md }, style]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={color.textMuted}
    />
  );
}

function buildStyles(color: ColorPalette) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: color.brand,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  headerTitle: { ...font.title, color: color.textOnBrand },

  identityCard: { marginBottom: space.lg },
  identityRow: { flexDirection: "row", alignItems: "center", gap: space.lg },
  photoBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: color.brand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: color.surface,
  },
  nameInput: { ...font.bodyStrong, marginBottom: space.sm },
  titleInput: {},
  availabilityBlock: {
    marginTop: space.lg,
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: color.divider,
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  switchTitle: { ...font.bodyStrong, color: color.text },
  switchSub: { ...font.sub, color: color.textMuted, marginTop: 2 },

  sectionRow: { marginTop: space.xl, marginBottom: space.sm, marginHorizontal: -space.lg },

  entryCard: { marginBottom: space.md },
  entryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.md,
  },
  entryIndex: { ...font.caption, color: color.textMuted },
  removeLink: { ...font.caption, color: color.danger },

  label: { ...font.caption, color: color.textSub, marginBottom: space.sm },
  spacedLabel: { marginTop: space.md },
  input: {
    borderWidth: 1.5,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: 13,
    paddingVertical: 12,
    ...font.body,
    color: color.text,
    backgroundColor: color.surface,
  },
  textarea: { minHeight: 110, textAlignVertical: "top" },
  textareaSm: { minHeight: 72, textAlignVertical: "top" },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  skillAddRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  removableChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: color.brandTint,
    borderRadius: radius.pill,
    paddingLeft: space.md,
    paddingRight: space.sm,
    paddingVertical: 7,
  },
  removableChipText: { ...font.caption, color: color.brand },
  removableChipX: { ...font.bodyStrong, color: color.brand, lineHeight: 16 },
  emptyHint: { ...font.sub, color: color.textMuted },

  salaryRow: { flexDirection: "row", gap: space.sm },
  cvFileRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    marginBottom: space.md,
  },
  cvFileText: { ...font.sub, color: color.textSub, flex: 1 },
  hintText: { ...font.caption, color: color.textMuted },
  });
}
