// PaMarket Auth — Google Sign In via Supabase
// Included on all website pages. Populates #headerAuth and #mobileNavAuth.
(function(){
'use strict';

const SB_URL='https://gxgytumhknmnwspxjzxw.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4Z3l0dW1oa25tbndzcHhqenh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNzMwNDUsImV4cCI6MjA5MzY0OTA0NX0.ddJhWdUy7JVrSfdaSK8a0On3zuwssY2H4DWsxBhgbJs';

function getCallbackUrl(){
  // Works on GitHub Pages and locally
  const base=location.href.replace(/\/[^/]*(\?.*)?$/,'/');
  return base+'auth-callback.html';
}

function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

const paAuth={
  session:null,

  init(){
    try{
      const s=localStorage.getItem('pm_session');
      if(s){
        this.session=JSON.parse(s);
        // Discard if expired
        if(this.session.expires_at && Date.now()/1000 > this.session.expires_at-60){
          this.session=null;
          localStorage.removeItem('pm_session');
        }
      }
    }catch{this.session=null}
    const ready=()=>this._render();
    if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',ready)}
    else{ready()}
  },

  getUser(){return this.session?.user||null},
  getToken(){return this.session?.access_token||SB_KEY},
  isSignedIn(){return!!(this.session?.access_token)},

  signInWithGoogle(){
    sessionStorage.setItem('pm_return_url',location.href);
    window.location.href=`${SB_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(getCallbackUrl())}&flow_type=implicit`;
  },

  goToSignIn(){
    // Save current page so auth.html can redirect back after sign-in
    sessionStorage.setItem('pm_return_url',location.href);
    const base=location.href.replace(/\/[^/]*(\?.*)?$/,'/');
    window.location.href=base+'auth.html?return='+encodeURIComponent(location.href);
  },

  async signOut(){
    try{
      if(this.session?.access_token){
        await fetch(`${SB_URL}/auth/v1/logout`,{
          method:'POST',
          headers:{'apikey':SB_KEY,'Authorization':'Bearer '+this.session.access_token}
        });
      }
    }catch{}
    localStorage.removeItem('pm_session');
    this.session=null;
    this._render();
  },

  setSession(s){
    this.session=s;
    localStorage.setItem('pm_session',JSON.stringify(s));
    this._render();
  },

  _googleSvg(){
    return`<svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>`;
  },

  _render(){
    this._renderHeader();
    this._renderMobile();
  },

  _renderHeader(){
    const el=document.getElementById('headerAuth');
    if(!el)return;
    const u=this.getUser();
    if(u){
      const name=u.user_metadata?.full_name||u.user_metadata?.name||u.email||'';
      const short=(name.split(' ')[0]||'Account').slice(0,16);
      const avatar=u.user_metadata?.avatar_url||u.user_metadata?.picture||'';
      el.innerHTML=`<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
        ${avatar
          ?`<img src="${esc(avatar)}" alt="${esc(short)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid #EEF2FF">`
          :`<div style="width:32px;height:32px;border-radius:50%;background:#1A3A8F;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0">${esc((short[0]||'?').toUpperCase())}</div>`
        }
        <span style="font-size:14px;font-weight:600;color:#1A1A2E;white-space:nowrap;max-width:90px;overflow:hidden;text-overflow:ellipsis">${esc(short)}</span>
        <button onclick="paAuth.signOut()" style="font-size:12px;color:#667085;background:none;border:1.5px solid #E4E8F0;border-radius:6px;cursor:pointer;padding:4px 10px;white-space:nowrap;font-family:inherit">Sign Out</button>
      </div>`;
    }else{
      el.innerHTML=`<a href="javascript:void(0)" onclick="paAuth.goToSignIn()" style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;background:#fff;color:#1A1A2E;border:1.5px solid #E4E8F0;font-family:inherit;white-space:nowrap;transition:box-shadow .2s;text-decoration:none" onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,.12)'" onmouseout="this.style.boxShadow='none'">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A3A8F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        Sign In
      </a>`;
    }
  },

  _renderMobile(){
    const el=document.getElementById('mobileNavAuth');
    if(!el)return;
    const u=this.getUser();
    if(u){
      const name=u.user_metadata?.full_name||u.user_metadata?.name||u.email||'';
      const short=(name.split(' ')[0]||'Account').slice(0,20);
      el.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-top:1px solid #E4E8F0;margin-top:8px">
        <span style="font-size:15px;font-weight:700;color:#1A1A2E">${esc(short)}</span>
        <button onclick="paAuth.signOut()" style="font-size:13px;color:#ef4444;background:none;border:none;cursor:pointer;font-family:inherit;font-weight:600">Sign Out</button>
      </div>`;
    }else{
      el.innerHTML=`<div style="padding:12px 0 4px">
        <a href="javascript:void(0)" onclick="paAuth.goToSignIn()" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;background:#1A3A8F;color:#fff;border:none;font-family:inherit;text-decoration:none">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Sign In / Create Account
        </a>
      </div>`;
    }
  }
};

paAuth.init();
window.paAuth=paAuth;
})();
