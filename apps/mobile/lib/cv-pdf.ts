// "Download CV as PDF" for job seekers: turns the structured CV the app
// already stores into a clean, printable one-page-style PDF and opens the
// share sheet (save to Files/Drive, send on WhatsApp or email to employers
// outside PaMarket).
//
// expo-print is a native module added in v1.30 — loaded lazily like
// lib/share-image.ts so an OTA update on an older binary falls back to a
// plain-text share instead of crashing.
import { Share } from "react-native";
import type { CvCertification, CvEducation, CvExperience, CvLanguage } from "./jobs";

export type CvPdfInput = {
  fullName: string;
  jobTitle?: string;
  city?: string;
  province?: string;
  email?: string | null;
  phone?: string | null;
  bio?: string;
  skills: string[];
  experience: CvExperience[];
  education: CvEducation[];
  certifications: CvCertification[];
  languages: CvLanguage[];
};

function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

export function buildCvHtml(cv: CvPdfInput): string {
  const contact = [cv.email, cv.phone, [cv.city, cv.province].filter(Boolean).join(", ")].filter(Boolean).map(esc).join(" &nbsp;·&nbsp; ");
  const section = (title: string, body: string) => (body ? `<h2>${title}</h2>${body}` : "");
  const exp = cv.experience
    .filter((e) => e.title || e.company)
    .map((e) => `<div class="item"><div class="row"><b>${esc(e.title)}</b><span>${esc(e.duration)}</span></div><div class="sub">${esc(e.company)}</div>${e.desc ? `<p>${esc(e.desc)}</p>` : ""}</div>`)
    .join("");
  const edu = cv.education
    .filter((e) => e.school || e.degree)
    .map((e) => `<div class="item"><div class="row"><b>${esc(e.degree)}</b><span>${esc(e.year)}</span></div><div class="sub">${esc(e.school)}</div></div>`)
    .join("");
  const certs = cv.certifications
    .filter((c) => c.name)
    .map((c) => `<li>${esc(c.name)}${c.issuer ? ` — ${esc(c.issuer)}` : ""}${c.year ? ` (${esc(c.year)})` : ""}</li>`)
    .join("");
  const langs = cv.languages
    .filter((l) => l.language)
    .map((l) => `${esc(l.language)}${l.proficiency ? ` (${esc(l.proficiency)})` : ""}`)
    .join(", ");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif;color:#111827;margin:36px 40px;font-size:12.5px;line-height:1.5}
h1{font-size:26px;margin:0;color:#1A3A8F}.title{font-size:15px;font-weight:600;margin-top:2px}
.contact{color:#4B5563;margin-top:6px}h2{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#1A3A8F;border-bottom:1.5px solid #E5E7EB;padding-bottom:4px;margin:22px 0 8px}
.item{margin-bottom:10px}.row{display:flex;justify-content:space-between;gap:12px}.row span{color:#6B7280;white-space:nowrap}
.sub{color:#374151}p{margin:4px 0 0}ul{margin:0;padding-left:18px}.skills span{display:inline-block;background:#EEF2FF;color:#1A3A8F;border-radius:10px;padding:2px 9px;margin:0 6px 6px 0}
.foot{margin-top:28px;color:#9CA3AF;font-size:10px}
</style></head><body>
<h1>${esc(cv.fullName) || "Curriculum Vitae"}</h1>
${cv.jobTitle ? `<div class="title">${esc(cv.jobTitle)}</div>` : ""}
${contact ? `<div class="contact">${contact}</div>` : ""}
${section("Profile", cv.bio ? `<p>${esc(cv.bio)}</p>` : "")}
${section("Experience", exp)}
${section("Education", edu)}
${section("Skills", cv.skills.length ? `<div class="skills">${cv.skills.map((s) => `<span>${esc(s)}</span>`).join("")}</div>` : "")}
${section("Certifications", certs ? `<ul>${certs}</ul>` : "")}
${section("Languages", langs ? `<p>${langs}</p>` : "")}
<div class="foot">Created with PaMarket Jobs · pamarketzw.com</div>
</body></html>`;
}

function plainText(cv: CvPdfInput): string {
  const lines = [cv.fullName, cv.jobTitle, [cv.email, cv.phone].filter(Boolean).join(" · "), "", cv.bio ?? ""];
  if (cv.experience.length) lines.push("", "EXPERIENCE", ...cv.experience.map((e) => `- ${e.title ?? ""}, ${e.company ?? ""} (${e.duration ?? ""})`));
  if (cv.education.length) lines.push("", "EDUCATION", ...cv.education.map((e) => `- ${e.degree ?? ""}, ${e.school ?? ""} ${e.year ?? ""}`));
  if (cv.skills.length) lines.push("", "SKILLS", cv.skills.join(", "));
  return lines.filter((l) => l !== undefined).join("\n");
}

type PrintModule = { printToFileAsync: (o: { html: string; base64?: boolean }) => Promise<{ uri: string }> };
type SharingModule = { isAvailableAsync: () => Promise<boolean>; shareAsync: (uri: string, o?: { mimeType?: string; dialogTitle?: string; UTI?: string }) => Promise<void> };

export async function exportCvPdf(cv: CvPdfInput): Promise<"pdf" | "text"> {
  let print: PrintModule | null = null;
  let sharing: SharingModule | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    print = require("expo-print");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sharing = require("expo-sharing");
  } catch {
    print = null;
  }
  if (print && sharing) {
    try {
      const { uri } = await print.printToFileAsync({ html: buildCvHtml(cv) });
      if (await sharing.isAvailableAsync()) {
        await sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share your CV", UTI: "com.adobe.pdf" });
        return "pdf";
      }
    } catch {
      // fall through to text
    }
  }
  try {
    await Share.share({ message: plainText(cv) });
  } catch {
    // cancelled
  }
  return "text";
}
