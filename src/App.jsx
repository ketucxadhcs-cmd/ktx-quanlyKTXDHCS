import React, { useState, useEffect, useCallback, useId, useRef } from "react";
import {
  Shield, Users, DoorOpen, Wrench, Boxes, FolderOpen, LogOut, Plus, Trash2, Star,
  ChevronRight, Loader2, X, ClipboardCheck, CheckCircle2, Circle, Paperclip, MapPin,
  Image as ImageIcon, Menu, KeyRound, Pencil, Search, Eye, EyeOff, Upload, FileSpreadsheet,
  ArrowRightLeft, LayoutGrid, Building2, BedDouble, AlertTriangle, Bell, Zap, Repeat,
} from "lucide-react";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import crest from "./assets/crest.png";

/* ============ THEME =============
   Nền hồ sơ giấy cũ, xanh nước biển, vàng CSGT, đỏ hiệu lệnh, vàng sao.
   Display: Oswald (nhãn, tiêu đề, kiểu bảng công vụ)
   Body: Be Vietnam Pro (đọc tiếng Việt tốt)
   Mono: Roboto Mono (số hiệu, ngày tháng, mã số)
*/
const T = {
  paper: "#F7F3E7",
  paperDark: "#ECE4D0",
  green: "#1F5573",
  greenDark: "#123145",
  amber: "#E8AE4C",
  amberDark: "#C28F35",
  red: "#B23347",
  gold: "#D4AF37",
  ink: "#22282C",
  inkSoft: "#636B6F",
  selectBg: "#FBEACB",
  selectBorder: "#B9822A",
};

// Trộn thêm hiệu ứng tô vàng hổ phách khi dòng đang được chọn (dùng chung cho mọi danh sách)
function withSelect(style, selected) {
  return selected
    ? { ...style, background: T.selectBg, boxShadow: `inset 0 0 0 2px ${T.selectBorder}` }
    : style;
}

const KTX_PASSWORD_DEFAULT = "KTXCSND"; // Mật khẩu chung mặc định — đổi được ở mục "Đổi mật khẩu"
const ADMIN_PASSWORD_DEFAULT = "KTXADMIN"; // Mật khẩu quản trị mặc định — đổi được ở mục "Đổi mật khẩu"
const DATA_NS = "ktxcsnd"; // Tên collection Firestore riêng cho trang Ký túc xá (không lẫn dữ liệu khác)

/* ============ PHÂN QUYỀN ============
   admin  : đăng nhập bằng ADMIN_PASSWORD — toàn quyền, kể cả gán quyền cho người khác
   can_bo : được quản trị gán — quyền quản lý phòng ở, sinh viên, tài sản, cập nhật bảo trì (Ban quản lý / Kỹ thuật KTX)
   sinh_vien: mặc định — chỉ được gửi yêu cầu bảo trì và xem thông tin, tự xoá yêu cầu do chính mình gửi
*/
const normalizeName = (n) => (n || "").trim().toLowerCase();

// Tải file thật sự về máy (giống Zalo/Messenger) thay vì chỉ mở tab mới xem ảnh.
function forceDownload(url, filename) {
  if (!url) return;
  const cloudinaryMatch = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|video|raw)\/upload\/)(.*)$/);
  if (cloudinaryMatch) {
    const dlUrl = `${cloudinaryMatch[1]}fl_attachment/${cloudinaryMatch[2]}`;
    const a = document.createElement("a");
    a.href = dlUrl;
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  fetch(url, { mode: "cors" })
    .then((res) => { if (!res.ok) throw new Error("fetch failed"); return res.blob(); })
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename || url.split("/").pop().split("?")[0] || "tai-ve";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 8000);
    })
    .catch(() => window.open(url, "_blank"));
}

const FONT_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Be+Vietnam+Pro:wght@400;500;600;700&family=Roboto+Mono:wght@400;500;600&display=swap');
.f-display { font-family: 'Oswald', sans-serif; letter-spacing: 0.02em; }
.f-body { font-family: 'Be Vietnam Pro', sans-serif; }
.f-mono { font-family: 'Roboto Mono', monospace; }
.paper-tex {
  background-color: ${T.paper};
  background-image:
    radial-gradient(${T.paperDark} 0.6px, transparent 0.6px);
  background-size: 14px 14px;
}
.stamp-border { border: 1.5px solid ${T.gold}; }
.table-lines thead tr { border-bottom: 2px solid ${T.gold}; }
.table-lines tbody tr { border-bottom: 1px solid ${T.paperDark}; }
.table-lines tbody tr:last-child { border-bottom: none; }
.table-grid th, .table-grid td { border-right: 1px solid ${T.paperDark}; }
.table-grid th:last-child, .table-grid td:last-child { border-right: none; }
input[type="checkbox"], input[type="radio"] { accent-color: ${T.amberDark}; }
html { scrollbar-width: thin; scrollbar-color: ${T.amberDark} ${T.paper}; }
html::-webkit-scrollbar { width: 10px; height: 10px; }
html::-webkit-scrollbar-track { background: ${T.paper} !important; }
html::-webkit-scrollbar-thumb { background: ${T.amberDark} !important; border-radius: 6px; border: 2px solid ${T.paper}; }
html::-webkit-scrollbar-thumb:hover { background: ${T.amber} !important; }
html::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
.scrollbar-thin { scrollbar-width: thin; scrollbar-color: ${T.amberDark} ${T.paper}; }
.scrollbar-thin::-webkit-scrollbar { width: 7px; height: 7px; }
.scrollbar-thin::-webkit-scrollbar-track { background: ${T.paper} !important; border-radius: 4px; }
.scrollbar-thin::-webkit-scrollbar-thumb { background: ${T.amberDark} !important; border-radius: 4px; border: 1px solid ${T.paper}; }
.scrollbar-thin::-webkit-scrollbar-thumb:hover { background: ${T.amber} !important; }
.scrollbar-thin::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
.card-sheet {
  box-shadow: 0 2px 6px rgba(19,31,25,0.08), 0 14px 30px -14px rgba(19,31,25,0.22);
}
.card-item {
  box-shadow: 0 1px 2px rgba(19,31,25,0.05), 0 5px 14px -6px rgba(19,31,25,0.14);
  transition: box-shadow 0.18s ease, transform 0.18s ease;
}
.card-item:hover {
  box-shadow: 0 2px 4px rgba(19,31,25,0.07), 0 8px 18px -6px rgba(19,31,25,0.18);
}
.input-plain:focus {
  box-shadow: 0 0 0 3px rgba(227,167,62,0.35);
  border-color: ${T.green};
}
.btn-press { transition: filter 0.15s ease, transform 0.1s ease; }
.btn-press:hover { filter: brightness(1.08); }
.btn-press:active { transform: translateY(1px); }
.nav-item { transition: background-color 0.15s ease, border-color 0.15s ease; position: relative; }
.nav-item:hover:not(.nav-item-active) { background: rgba(255,255,255,0.06) !important; }
.icon-badge {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 999px; flex-shrink: 0;
}
:focus-visible { outline: 2px solid ${T.amber}; outline-offset: 2px; }
.drawer-backdrop { transition: opacity 0.25s ease; }
@media (prefers-reduced-motion: reduce) {
  * { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; }
}
`;

/* ============ EMBLEM (huy hiệu Trường Đại học Cảnh sát nhân dân) ============ */
function Emblem({ size = 56, ring = false }) {
  const img = (
    <img
      src={crest}
      alt="Huy hiệu Trường Đại học Cảnh sát nhân dân"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: "contain", display: "block" }}
    />
  );
  if (!ring) return img;
  const pad = Math.round(size * 0.16);
  return (
    <div
      style={{
        width: size + pad * 2,
        height: size + pad * 2,
        borderRadius: "999px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: T.greenDark,
        border: `1px solid ${T.gold}`,
        boxShadow: "0 2px 6px rgba(0,0,0,0.35), inset 0 0 0 3px rgba(227,167,62,0.12)",
      }}
    >
      {img}
    </div>
  );
}

/* ============ SEAL (con dấu tròn trang trí — điểm nhấn thị giác) ============ */
function Seal({ size = 130, opacity = 1 }) {
  const rid = useId().replace(/[:]/g, "");
  const label = "KÝ TÚC XÁ · ĐẠI HỌC CẢNH SÁT NHÂN DÂN · QUẢN LÝ NỘI TRÚ · ";
  return (
    <div style={{ position: "relative", width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <path id={`sealpath-${rid}`} d="M 100,100 m -80,0 a 80,80 0 1,1 160,0 a 80,80 0 1,1 -160,0" />
        </defs>
        <circle cx="100" cy="100" r="94" fill="none" stroke={T.red} strokeWidth="1.2" opacity={opacity} />
        <circle cx="100" cy="100" r="63" fill="none" stroke={T.red} strokeWidth="1" opacity={opacity} />
        <text fontSize="10.5" fill={T.red} letterSpacing="1.5" opacity={opacity}>
          <textPath href={`#sealpath-${rid}`} startOffset="0%">{label}</textPath>
        </text>
      </svg>
      <img
        src={crest}
        alt=""
        style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          width: size * 0.46, height: "auto",
          opacity,
        }}
      />
    </div>
  );
}

/* ============ CORNER MARKS (góc chỉ dẫn kiểu hồ sơ công vụ) ============ */
function CornerMarks({ inset = 10, length = 18, color }) {
  const c = color || T.gold;
  const base = { position: "absolute", width: length, height: length, borderColor: c };
  return (
    <>
      <span style={{ ...base, top: inset, left: inset, borderTop: `2px solid ${c}`, borderLeft: `2px solid ${c}` }} />
      <span style={{ ...base, top: inset, right: inset, borderTop: `2px solid ${c}`, borderRight: `2px solid ${c}` }} />
      <span style={{ ...base, bottom: inset, left: inset, borderBottom: `2px solid ${c}`, borderLeft: `2px solid ${c}` }} />
      <span style={{ ...base, bottom: inset, right: inset, borderBottom: `2px solid ${c}`, borderRight: `2px solid ${c}` }} />
    </>
  );
}

/* ============ BÁO LỖI TRỰC TIẾP TRÊN MÀN HÌNH (không cần mở DevTools) ============ */
let _globalErrors = [];
let _errorListeners = [];

async function downloadFileFromUrl(url, filename) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank");
  }
}
function reportGlobalError(message) {
  const entry = { id: Date.now() + Math.random(), message };
  _globalErrors = [..._globalErrors, entry].slice(-4);
  _errorListeners.forEach((fn) => fn(_globalErrors));
}
function useGlobalErrors() {
  const [errors, setErrors] = useState(_globalErrors);
  useEffect(() => {
    _errorListeners.push(setErrors);
    return () => { _errorListeners = _errorListeners.filter((fn) => fn !== setErrors); };
  }, []);
  const dismiss = (id) => {
    _globalErrors = _globalErrors.filter((e) => e.id !== id);
    setErrors(_globalErrors);
  };
  return { errors, dismiss };
}
function ErrorBanner() {
  const { errors, dismiss } = useGlobalErrors();
  if (errors.length === 0) return null;
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999 }} className="p-2 space-y-1.5">
      {errors.map((e) => (
        <div
          key={e.id}
          className="f-body text-xs px-4 py-3 flex items-start justify-between gap-3"
          style={{ background: T.red, color: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
        >
          <span className="flex-1"><b>Lỗi kết nối dữ liệu:</b> {e.message}</span>
          <button onClick={() => dismiss(e.id)} style={{ color: "#fff" }} aria-label="Đóng"><X size={15} /></button>
        </div>
      ))}
    </div>
  );
}

/* ============ STORAGE HOOK (Firestore) ============
   Mỗi "key" tương ứng với một document trong collection riêng của trang Ký túc xá.
   Dùng onSnapshot để đồng bộ real-time: một người thêm/xoá, mọi người khác
   thấy ngay lập tức mà không cần tải lại trang.
*/
function useSharedList(key) {
  const [items, setItemsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    const ref = doc(db, DATA_NS, key);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          try {
            setItemsState(data.value ? JSON.parse(data.value) : []);
          } catch (e) {
            setItemsState([]);
          }
        } else {
          setItemsState([]);
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        const msg = `Đọc "${key}" thất bại — ${err?.code || ""} ${err?.message || err}`;
        setError(msg);
        setLoading(false);
        reportGlobalError(msg);
      }
    );
    return () => unsub();
  }, [key]);

  const persist = async (next) => {
    setItemsState(next);
    try {
      const ref = doc(db, DATA_NS, key);
      await setDoc(ref, { value: JSON.stringify(next) });
    } catch (e) {
      const msg = `Lưu "${key}" thất bại — ${e?.code || ""} ${e?.message || e}`;
      setError(msg);
      reportGlobalError(msg);
    }
  };

  return { items, setItems: persist, loading, error };
}

/* ============ CẤU HÌNH DÙNG CHUNG (1 tài liệu duy nhất) ============ */
function useSingleDoc(key, defaultValue) {
  const [value, setValueState] = useState(defaultValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, DATA_NS, key);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists() && snap.data().value) {
          try {
            setValueState({ ...defaultValue, ...JSON.parse(snap.data().value) });
          } catch (e) {
            // giữ mặc định nếu dữ liệu lỗi
          }
        }
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = async (next) => {
    setValueState(next);
    try {
      await setDoc(doc(db, DATA_NS, key), { value: JSON.stringify(next) });
      return true;
    } catch (e) {
      reportGlobalError(`Lưu "${key}" thất bại — ${e?.code || ""} ${e?.message || e}`);
      return false;
    }
  };

  return { value, setValue: update, loading };
}

function useAuthConfig() {
  const [config, setConfigState] = useState({ unitPassword: KTX_PASSWORD_DEFAULT, adminPassword: ADMIN_PASSWORD_DEFAULT });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, DATA_NS, "authConfig");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists() && snap.data().value) {
          try {
            const parsed = JSON.parse(snap.data().value);
            setConfigState({
              unitPassword: parsed.unitPassword || KTX_PASSWORD_DEFAULT,
              adminPassword: parsed.adminPassword || ADMIN_PASSWORD_DEFAULT,
            });
          } catch (e) {
            // giữ mặc định nếu dữ liệu lỗi
          }
        }
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const update = async (next) => {
    setConfigState(next);
    try {
      await setDoc(doc(db, DATA_NS, "authConfig"), { value: JSON.stringify(next) });
      return true;
    } catch (e) {
      reportGlobalError(`Đổi mật khẩu thất bại — ${e?.code || ""} ${e?.message || e}`);
      return false;
    }
  };

  return { config, setConfig: update, loading };
}

/* ============ PHÂN QUYỀN THEO NGƯỜI DÙNG ============ */
function useRole(user, isAdminLogin) {
  const { items: permissions, setItems: setPermissions, loading: permLoading } = useSharedList("permissions");
  const explicit = permissions.find((p) => normalizeName(p.name) === normalizeName(user));

  let role = "sinh_vien";
  if (isAdminLogin) role = "admin";
  else if (explicit) role = explicit.role;

  const canManage = role === "admin" || role === "can_bo";
  const canMaintain = canManage || role === "ky_thuat";

  const perm = {
    name: user,
    role,
    isAdmin: role === "admin",
    canManage,
    canMaintain,
    isOwner: (ownerName) => normalizeName(ownerName) === normalizeName(user),
  };
  return { perm, permissions, setPermissions, permLoading };
}

/* ============ SMALL UI HELPERS ============ */
function SectionHeader({ icon: Icon, eyebrow, title, action, compact }) {
  return (
    <div className={compact ? "flex items-center justify-between mb-3 pb-2.5 flex-wrap gap-2" : "flex items-center justify-between mb-5 pb-4 flex-wrap gap-3"} style={{ borderBottom: `1px solid ${T.paperDark}` }}>
      <div>
        <div className={compact ? "f-mono text-[10px] tracking-widest uppercase" : "f-mono text-xs tracking-widest uppercase"} style={{ color: T.amberDark }}>{eyebrow}</div>
        <h2 className={compact ? "f-display text-base md:text-lg font-semibold flex items-center gap-1.5 mt-0.5" : "f-display text-2xl md:text-3xl font-semibold flex items-center gap-2.5 mt-0.5"} style={{ color: T.green }}>
          <Icon size={compact ? 16 : 22} /> {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function Btn({ children, onClick, variant = "solid", type = "button", disabled, size }) {
  const base = size === "sm"
    ? "f-display text-[11px] tracking-wide uppercase px-2.5 py-1.5 flex items-center gap-1.5 disabled:opacity-50 btn-press"
    : "f-display text-sm tracking-wide uppercase px-4 py-2 flex items-center gap-2 disabled:opacity-50 btn-press";
  const style =
    variant === "solid"
      ? { background: T.green, color: T.paper, boxShadow: "0 1px 2px rgba(19,31,25,0.25)" }
      : variant === "danger"
      ? { background: "transparent", color: T.red, border: `1.5px solid ${T.red}` }
      : { background: "transparent", color: T.green, border: `1.5px solid ${T.green}` };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={base} style={style}>
      {children}
    </button>
  );
}

function Field({ label, children, required }) {
  return (
    <label className="block mb-3">
      <span className="f-mono text-[11px] uppercase tracking-widest block mb-1" style={{ color: T.inkSoft }}>
        {label}
        {required && <span style={{ color: T.red }} title="Bắt buộc nhập"> *</span>}
      </span>
      {children}
    </label>
  );
}
const inputStyle = { background: "#fff", border: `1px solid #C9BFA5`, color: T.ink };
const inputCls = "f-body w-full px-3 py-2 outline-none text-sm rounded-sm input-plain";

function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        className={inputCls}
        style={{ ...inputStyle, paddingRight: 36 }}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2"
        style={{ color: T.inkSoft }}
        title={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function FormWarning({ message }) {
  if (!message) return null;
  return (
    <div
      className="f-body text-xs px-3 py-2.5 mb-3 flex items-start gap-2"
      style={{ background: "#FCEBEA", color: T.red, border: `1px solid ${T.red}` }}
      role="alert"
    >
      <span className="shrink-0">⚠</span> <span>{message}</span>
    </div>
  );
}

function LoadingRow() {
  return <div className="flex items-center gap-2 f-body text-sm py-6" style={{ color: T.inkSoft }}><Loader2 size={16} className="animate-spin" /> Đang tải dữ liệu…</div>;
}

function EmptyState({ text }) {
  return <div className="f-body text-sm italic py-8 text-center" style={{ color: T.inkSoft }}>{text}</div>;
}

/* ============ UPLOAD FIELD (tải ảnh/tệp trực tiếp từ máy — dùng Cloudinary) ============
   onUploaded(url, originalFileName, mimeType) được gọi 1 lần cho mỗi tệp tải lên thành công.
   Truyền multiple={true} để cho phép chọn/tải lên nhiều ảnh/tệp cùng lúc (vd: Thông báo). */
function UploadField({ onUploaded, multiple = false, label }) {
  const [status, setStatus] = useState("idle"); // idle | uploading | done | error
  const [errMsg, setErrMsg] = useState("");
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  const configured = Boolean(cloudName && uploadPreset);

  const uploadOne = async (file) => {
    const resourceType = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "raw";
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", uploadPreset);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, { method: "POST", body: fd });
    const data = await res.json();
    if (!data.secure_url) throw new Error(data?.error?.message || "Không rõ nguyên nhân, thử lại.");
    return data.secure_url;
  };

  const handleFile = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    if (!configured) {
      setStatus("error");
      setErrMsg("Chưa cấu hình Cloudinary (xem README).");
      return;
    }
    setStatus("uploading");
    try {
      for (const file of files) {
        const url = await uploadOne(file);
        onUploaded(url, file.name, file.type);
      }
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrMsg(String(err?.message || err));
    }
  };

  return (
    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
      <label
        className="f-display text-[11px] uppercase tracking-wider px-3 py-1.5 flex items-center gap-1.5 cursor-pointer btn-press"
        style={{ border: `1px solid ${T.green}`, color: T.green }}
      >
        {status === "uploading" ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
        {status === "uploading" ? "Đang tải lên…" : (label || (multiple ? "Tải ảnh / tệp từ máy (chọn được nhiều)" : "Tải ảnh / tệp từ máy"))}
        <input
          type="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
          multiple={multiple}
          className="hidden"
          onChange={handleFile}
          disabled={status === "uploading"}
        />
      </label>
      {status === "done" && (
        <span className="f-body text-xs flex items-center gap-1" style={{ color: T.green }}>
          <CheckCircle2 size={13} /> Đã tải lên
        </span>
      )}
      {status === "error" && (
        <span className="f-body text-xs" style={{ color: T.red }}>{errMsg}</span>
      )}
    </div>
  );
}

// Nhận biết đính kèm là hình ảnh hay tệp khác, để hiển thị xem trước ảnh hay biểu tượng tệp.
function isImageAttachment(a) {
  if (!a) return false;
  if (a.type) return a.type.startsWith("image/");
  return /\/image\/upload\//.test(a.url || "") || /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(a.url || "");
}

/* ============ LOGIN GATE ============ */
function LoginGate({ onLogin }) {
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const { config } = useAuthConfig();

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setErr("Nhập họ tên của bạn để hệ thống ghi nhận.");
      return;
    }
    if (pw === config.adminPassword) {
      onLogin(name.trim(), true);
      return;
    }
    if (pw !== config.unitPassword) {
      setErr("Mật khẩu không đúng. Liên hệ Ban quản lý ký túc xá để lấy mật khẩu.");
      return;
    }
    onLogin(name.trim(), false);
  };

  return (
    <div className="min-h-screen paper-tex flex items-center justify-center px-4 py-10">
      <style>{FONT_STYLE}</style>
      <ErrorBanner />
      <form
        onSubmit={submit}
        className="relative w-full max-w-md overflow-hidden card-sheet"
        style={{ background: "#fff", border: `1px solid ${T.paperDark}` }}
      >
        <div
          className="f-mono text-center text-[10px] tracking-[0.25em] uppercase py-2"
          style={{ background: T.red, color: "#fff" }}
        >
          Hệ thống quản lý ký túc xá
        </div>
        <div style={{ height: 3, background: T.gold }} />

        <div className="relative px-8 pt-8 pb-8">
          <CornerMarks inset={14} length={16} />
          <div style={{ position: "absolute", top: -10, right: -18, pointerEvents: "none" }}>
            <Seal size={150} opacity={0.06} />
          </div>

          <div className="relative flex flex-col items-center mb-6">
            <Emblem size={92} />
            <div className="f-mono text-[10.5px] tracking-[0.22em] uppercase mt-4" style={{ color: T.amberDark }}>
              Trường Đại học Cảnh sát nhân dân
            </div>
            <div className="f-mono text-[9.5px] tracking-[0.18em] uppercase" style={{ color: T.inkSoft }}>
              People's Police University
            </div>
            <h1 className="f-display text-2xl font-semibold text-center mt-2" style={{ color: T.green }}>
              QUẢN LÝ KÝ TÚC XÁ
            </h1>
            <div className="flex items-center gap-2 my-3">
              <span style={{ width: 24, height: 1, background: T.gold }} />
              <span style={{ width: 5, height: 5, transform: "rotate(45deg)", background: T.gold }} />
              <span style={{ width: 24, height: 1, background: T.gold }} />
            </div>
            <div className="f-body text-xs" style={{ color: T.inkSoft }}>Cổng truy cập nội bộ ký túc xá</div>
          </div>

          <div className="relative">
            <Field label="Họ và tên" required>
              <input className={inputCls} style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Nguyễn Văn A" />
            </Field>
            <Field label="Mật khẩu (chung ký túc xá hoặc quản trị)">
              <input type="password" className={inputCls} style={inputStyle} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" />
            </Field>

            {err && (
              <div className="f-body text-xs mb-3 px-3 py-2 flex items-start gap-2" style={{ color: T.red, background: "#F7E3E6", borderLeft: `3px solid ${T.red}` }}>
                {err}
              </div>
            )}

            <button
              type="submit"
              className="f-display w-full py-2.5 tracking-wide uppercase text-sm btn-press"
              style={{ background: T.green, color: T.paper, boxShadow: "0 2px 6px rgba(19,31,25,0.3)" }}
            >
              Vào trang quản lý
            </button>
            <p className="f-body text-[11px] mt-4 text-center" style={{ color: T.inkSoft }}>
              Dữ liệu trên trang này dùng chung cho toàn ký túc xá. Quyền thêm/xoá/sửa nội dung tuỳ theo vai trò được quản trị gán.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
   DỮ LIỆU DÙNG CHUNG: PHÒNG Ở, SINH VIÊN, TÀI SẢN, BẢO TRÌ
   ============================================================ */
const ROOM_STATUS = ["Trống", "Đang ở", "Đang bảo trì"];
const MAINTENANCE_REASONS = ["Học viên nghỉ lễ/Tết", "Học viên nghỉ hè", "Học viên đi thực tập", "Phòng hư hỏng cần sửa gấp", "Lý do khác"];
const TRANSFER_REASONS = ["Phòng hư hỏng cần sửa", "Gộp phòng do ít người", "Học viên nghỉ lễ/Tết", "Học viên nghỉ hè", "Học viên đi thực tập", "Lý do khác"];
const GENDER_OPTIONS = ["Nam", "Nữ"];
const NAM_HOC_OPTIONS = ["Năm 1", "Năm 2", "Năm 3", "Năm 4"];
const ASSET_CATEGORY = ["Điện", "Nước", "Cơ sở vật chất"];
const ASSET_STATUS = ["Tốt", "Hỏng", "Đang sửa", "Đã thanh lý"];
const MAINT_STATUS = ["Chờ xử lý", "Đang xử lý", "Hoàn thành", "Từ chối"];
const INSPECTION_CLASS = ["Tốt", "Khá", "Trung bình", "Vi phạm"];
const NOTIFICATION_SCOPES = [
  { key: "toan_ktx", label: "Toàn ký túc xá" },
  { key: "toa_nha", label: "Theo tòa nhà" },
  { key: "tang", label: "Theo tầng / khu vực" },
  { key: "phong", label: "Theo phòng" },
  { key: "khoa", label: "Theo khoá học" },
];

function classifyRoomInspection(score, hasViolation) {
  if (hasViolation) return "Vi phạm";
  const n = Number(score);
  if (!Number.isFinite(n)) return "Trung bình";
  if (n >= 9) return "Tốt";
  if (n >= 7) return "Khá";
  if (n >= 5) return "Trung bình";
  return "Vi phạm";
}

function roomLabel(r) {
  if (!r) return "—";
  return `${r.building || "?"} - Phòng ${r.roomNumber || "?"}`;
}
// Trạng thái phòng thực tế: "Đang bảo trì" luôn là cờ đánh dấu tay và được ưu tiên tuyệt đối; còn lại thì
// suy ra thẳng từ sĩ số thực có sinh viên hay không (không lệ thuộc vào trường status lưu tay dễ bị quên cập
// nhật khi bố trí/chuyển/trả phòng) — tránh tình trạng sĩ số đầy mà nhãn vẫn hiện "Trống".
function effectiveRoomStatus(room, occCount) {
  if ((room?.status || "Trống") === "Đang bảo trì") return "Đang bảo trì";
  return occCount > 0 ? "Đang ở" : "Trống";
}
// Giường tầng — mặc định ghép cặp 1 vị trí = 2 giường (dưới lẻ, trên chẵn): giường 1&2 = vị trí 1, 3&4 = vị trí 2...
// Sức chứa phòng vẫn tự do chỉnh (không giới hạn cứng 10 giường / 5 vị trí), đây chỉ là cách hiển thị mặc định.
function bedPosition(bedNo) {
  return { position: Math.ceil(bedNo / 2), role: bedNo % 2 === 1 ? "Dưới" : "Trên" };
}
// Chọn giường trống nhỏ nhất còn lại trong phòng cho 1 sinh viên mới được bố trí vào — để không phải gán tay.
function pickFreeBed(capacity, usedBeds) {
  const cap = Number(capacity) || 0;
  for (let n = 1; n <= cap; n++) { if (!usedBeds.has(String(n))) return String(n); }
  return "";
}
// So sánh "tự nhiên": số đứng trước chữ, "2" trước "10" (không phải so theo ký tự) — dùng để sắp xếp
// Toà nhà / Tầng / Số phòng theo đúng thứ tự khoa học thay vì thứ tự nhập liệu ngẫu nhiên.
function naturalCompare(a, b) {
  return String(a ?? "").localeCompare(String(b ?? ""), "vi", { numeric: true, sensitivity: "base" });
}
function formatDob(dob) {
  if (!dob) return "—";
  const parts = String(dob).split("-");
  if (parts.length !== 3) return dob;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}
function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("vi-VN");
  } catch { return iso; }
}
function formatMonth(m) {
  if (!m) return "—";
  const parts = String(m).split("-");
  if (parts.length !== 2) return m;
  const [y, mo] = parts;
  return `Tháng ${mo}/${y}`;
}

/* ============ NHẬP DỮ LIỆU TỪ ẢNH/TỆP (dùng chung khung cho Sinh viên) ============ */
function guessStudentField(header) {
  const h = String(header || "").toLowerCase();
  if (/stt|số\s*thứ\s*tự/.test(h)) return "stt";
  if (/mã\s*số|msv|mssv/.test(h)) return "msv";
  if (/họ.*tên|^tên$|full\s*name|^name$/.test(h)) return "name";
  if (/giới\s*tính|gender/.test(h)) return "gender";
  if (/khoá|khoa\s*học|^khoa$/.test(h)) return "khoa";
  if (/^lớp$|^lop$|class/.test(h)) return "lop";
  if (/đại\s*đội|dai\s*doi/.test(h)) return "daiDoi";
  if (/đơn\s*vị.*tuyển\s*sinh|dvts/.test(h)) return "donViTuyenSinh";
  if (/năm\s*học/.test(h)) return "namHoc";
  if (/ngày\s*sinh|năm\s*sinh|dob|birth/.test(h)) return "dob";
  if (/sđt|điện\s*thoại|phone|sdt/.test(h)) return "phone";
  if (/phòng|room/.test(h)) return "roomNumber";
  return "";
}
const STUDENT_IMPORT_FIELDS = [
  { key: "", label: "— Bỏ qua cột này —" },
  { key: "stt", label: "STT" },
  { key: "msv", label: "Mã số SV" },
  { key: "name", label: "Họ và tên" },
  { key: "gender", label: "Giới tính" },
  { key: "khoa", label: "Khoá học" },
  { key: "lop", label: "Lớp" },
  { key: "daiDoi", label: "Đại đội" },
  { key: "donViTuyenSinh", label: "Đơn vị tuyển sinh" },
  { key: "namHoc", label: "Năm học" },
  { key: "dob", label: "Ngày sinh" },
  { key: "phone", label: "SĐT" },
  { key: "roomNumber", label: "Số phòng (ghi chú)" },
];
function normalizeDobInput(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;
  return s;
}
function normalizeGenderInput(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (/^n(ữ)?$|female|f/.test(s)) return "Nữ";
  if (/^nam$|male|^m$/.test(s)) return "Nam";
  return raw || "";
}
function parseCSVText(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; } }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* bỏ qua */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}
let _xlsxLoadPromise = null;
function loadXLSXLib() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (_xlsxLoadPromise) return _xlsxLoadPromise;
  _xlsxLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error("Không tải được thư viện đọc Excel — kiểm tra kết nối mạng."));
    document.head.appendChild(script);
  });
  return _xlsxLoadPromise;
}

function StudentImportPanel({ existingItems, onConfirm, onClose }) {
  const [srcMode, setSrcMode] = useState("file"); // "file" | "image"

  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [colMap, setColMap] = useState([]);
  const [fileErr, setFileErr] = useState("");
  const [fileBusy, setFileBusy] = useState(false);

  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileErr(""); setFileBusy(true);
    try {
      const isCsv = /\.csv$/i.test(file.name);
      let rows = [];
      if (isCsv) {
        const text = await file.text();
        rows = parseCSVText(text);
      } else {
        const XLSX = await loadXLSXLib();
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" })
          .map((r) => r.map((c) => String(c ?? "")))
          .filter((r) => r.some((c) => String(c).trim() !== ""));
      }
      if (rows.length === 0) { setFileErr("Không đọc được dữ liệu nào từ file này."); setFileBusy(false); return; }
      const colCount = Math.max(...rows.map((r) => r.length));
      const headerRow = rows[0] || [];
      setColMap(Array.from({ length: colCount }, (_, i) => guessStudentField(headerRow[i])));
      setRawRows(rows);
      setFileName(file.name);
      setSelectedRows({});
    } catch (err) {
      setFileErr(`Đọc file thất bại — ${err?.message || err}`);
    }
    setFileBusy(false);
  };

  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
  const mappedFileRows = dataRows.map((r) => {
    const o = { stt: "", msv: "", name: "", gender: "", khoa: "", lop: "", daiDoi: "", donViTuyenSinh: "", namHoc: "", dob: "", phone: "", roomNumber: "" };
    colMap.forEach((key, i) => { if (key && r[i] !== undefined) o[key] = String(r[i]).trim(); });
    if (o.dob) o.dob = normalizeDobInput(o.dob);
    if (o.gender) o.gender = normalizeGenderInput(o.gender);
    return o;
  });

  const [imageUrl, setImageUrl] = useState("");
  const [ocrRows, setOcrRows] = useState(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrErr, setOcrErr] = useState("");
  const [ocrNotConfigured, setOcrNotConfigured] = useState(false);

  const runOCR = async () => {
    if (!imageUrl) return;
    setOcrBusy(true); setOcrErr(""); setOcrNotConfigured(false); setOcrRows(null);
    try {
      const res = await fetch("/api/ocr-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      if (res.status === 404) { setOcrNotConfigured(true); setOcrBusy(false); return; }
      const data = await res.json();
      if (!res.ok) {
        if (data?.notConfigured) setOcrNotConfigured(true);
        else setOcrErr(data?.error || "Đọc ảnh thất bại, thử lại.");
        setOcrBusy(false);
        return;
      }
      const rows = Array.isArray(data.rows) ? data.rows : [];
      setOcrRows(rows.map((r) => ({
        stt: String(r.stt ?? "").trim(),
        msv: String(r.msv ?? "").trim(),
        name: String(r.name ?? "").trim(),
        gender: normalizeGenderInput(r.gender),
        khoa: String(r.khoa ?? "").trim(),
        lop: String(r.lop ?? "").trim(),
        daiDoi: String(r.daiDoi ?? "").trim(),
        donViTuyenSinh: String(r.donViTuyenSinh ?? "").trim(),
        namHoc: String(r.namHoc ?? "").trim(),
        dob: normalizeDobInput(r.dob),
        phone: String(r.phone ?? "").trim(),
        roomNumber: String(r.roomNumber ?? "").trim(),
      })));
      setSelectedRows({});
    } catch (err) {
      setOcrNotConfigured(true);
    }
    setOcrBusy(false);
  };

  const editOcrRow = (idx, key, value) => {
    setOcrRows((rows) => rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };

  const previewRows = srcMode === "file" ? mappedFileRows : (ocrRows || []);
  const [selectedRows, setSelectedRows] = useState({});
  const existingMsvSet = new Set(existingItems.map((m) => normalizeName(m.msv)).filter(Boolean));
  const existingNameSet = new Set(existingItems.map((m) => normalizeName(m.name)));
  const isDup = (r) => (r.msv && existingMsvSet.has(normalizeName(r.msv))) || (!r.msv && r.name && existingNameSet.has(normalizeName(r.name)));

  useEffect(() => {
    const next = {};
    previewRows.forEach((r, i) => { next[i] = Boolean(r.name) && !isDup(r); });
    setSelectedRows(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mappedFileRows.length, ocrRows]);

  const toggleRow = (i) => setSelectedRows((s) => ({ ...s, [i]: !s[i] }));
  const checkedCount = Object.values(selectedRows).filter(Boolean).length;

  // Chọn nhanh theo tiêu chí — chọn tất cả, hoặc lọc theo Khoá / Lớp (Trung đội) / Năm học rồi tick hàng loạt.
  const [qKhoa, setQKhoa] = useState("");
  const [qLop, setQLop] = useState("");
  const [qNamHoc, setQNamHoc] = useState("");
  const uniqSorted = (vals) => [...new Set(vals.map((v) => (v || "").trim()).filter(Boolean))].sort(naturalCompare);
  const khoaOptions = uniqSorted(previewRows.map((r) => r.khoa));
  const lopOptions = uniqSorted(previewRows.map((r) => r.lop));
  const namHocOptions = uniqSorted(previewRows.map((r) => r.namHoc));
  const matchesQuick = (r) =>
    (!qKhoa || (r.khoa || "").trim() === qKhoa) &&
    (!qLop || (r.lop || "").trim() === qLop) &&
    (!qNamHoc || (r.namHoc || "").trim() === qNamHoc);
  const quickMatchCount = previewRows.filter((r) => r.name && matchesQuick(r)).length;
  const selectAllRows = () => setSelectedRows(previewRows.reduce((acc, r, i) => { acc[i] = Boolean(r.name); return acc; }, {}));
  const clearAllRows = () => setSelectedRows({});
  const selectByQuick = () => setSelectedRows((s) => {
    const next = { ...s };
    previewRows.forEach((r, i) => { if (r.name && matchesQuick(r)) next[i] = true; });
    return next;
  });
  const deselectByQuick = () => setSelectedRows((s) => {
    const next = { ...s };
    previewRows.forEach((r, i) => { if (matchesQuick(r)) next[i] = false; });
    return next;
  });

  const confirmImport = () => {
    const chosen = previewRows.filter((r, i) => selectedRows[i] && r.name);
    if (chosen.length === 0) return;
    onConfirm(chosen.map((r, idx) => ({
      id: Date.now() + idx,
      stt: r.stt || "",
      msv: r.msv || "",
      name: r.name,
      gender: r.gender || "Nam",
      khoa: r.khoa || "",
      lop: r.lop || "",
      namHoc: r.namHoc || "Năm 1",
      phone: r.phone || "",
      dob: r.dob || "",
      roomId: "",
      bed: "",
      status: "Chưa xếp phòng",
      note: r.roomNumber ? `Ghi chú số phòng khi nhập: ${r.roomNumber}` : "",
    })));
  };

  return (
    <div className="stamp-border p-3 mb-3" style={{ background: "#fff" }}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <span className="f-display text-[11.5px] uppercase tracking-wider" style={{ color: T.amberDark }}>
          Nhập Sinh viên nội trú từ ảnh / tệp
        </span>
        <button onClick={onClose} title="Đóng"><X size={16} style={{ color: T.inkSoft }} /></button>
      </div>

      <div className="flex gap-2 mb-3">
        <Btn size="sm" variant={srcMode === "file" ? "solid" : "outline"} onClick={() => setSrcMode("file")}>
          <FileSpreadsheet size={13} /> Từ file Excel/CSV
        </Btn>
        <Btn size="sm" variant={srcMode === "image" ? "solid" : "outline"} onClick={() => setSrcMode("image")}>
          <ImageIcon size={13} /> Từ ảnh chụp (AI đọc chữ)
        </Btn>
      </div>

      {srcMode === "file" ? (
        <div>
          <p className="f-body text-[11px] italic mb-2" style={{ color: T.inkSoft }}>
            Chọn file Excel (.xlsx/.xls) hoặc CSV — đọc trực tiếp trong trình duyệt, không cần AI, chính xác 100%
            theo đúng dữ liệu trong file. Sau khi đọc xong, bạn chọn cột nào ứng với thông tin nào rồi tick dòng cần lấy.
          </p>
          <label className="f-display text-[11px] uppercase tracking-wider px-3 py-1.5 inline-flex items-center gap-1.5 cursor-pointer btn-press" style={{ border: `1px solid ${T.green}`, color: T.green }}>
            {fileBusy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {fileBusy ? "Đang đọc file…" : "Chọn file từ máy"}
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFilePicked} />
          </label>
          {fileName && <span className="f-body text-[11px] ml-2" style={{ color: T.inkSoft }}>Đã chọn: {fileName}</span>}
          {fileErr && <div className="f-body text-xs mt-2" style={{ color: T.red }}>{fileErr}</div>}

          {rawRows.length > 0 && (
            <>
              <label className="flex items-center gap-2 mt-3 f-body text-xs cursor-pointer" style={{ color: T.ink }}>
                <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
                Dòng đầu tiên là tiêu đề cột (không lấy làm dữ liệu)
              </label>

              <div className="f-mono text-[10.5px] uppercase tracking-widest mt-3 mb-1" style={{ color: T.amberDark }}>Chọn cột nào ứng với thông tin nào</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-3">
                {colMap.map((val, i) => (
                  <div key={i}>
                    <div className="f-body text-[10px] truncate mb-0.5" style={{ color: T.inkSoft }} title={rawRows[0]?.[i]}>
                      Cột {i + 1}{hasHeader && rawRows[0]?.[i] ? `: "${rawRows[0][i]}"` : ""}
                    </div>
                    <select
                      className={inputCls}
                      style={{ ...inputStyle, fontSize: "11.5px", padding: "4px 6px" }}
                      value={val}
                      onChange={(e) => setColMap((cm) => cm.map((v, ci) => (ci === i ? e.target.value : v)))}
                    >
                      {STUDENT_IMPORT_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div>
          <p className="f-body text-[11px] italic mb-2" style={{ color: T.inkSoft }}>
            Tải lên ảnh chụp danh sách sinh viên (chữ in hoặc viết tay) — hệ thống dùng AI đọc chữ (OCR) để lấy thông tin.
            Tính năng này cần cấu hình API riêng trên máy chủ; nếu chưa cấu hình, hệ thống sẽ báo rõ bên dưới.
          </p>
          <UploadField onUploaded={(url) => { setImageUrl(url); setOcrRows(null); setOcrErr(""); setOcrNotConfigured(false); }} />
          {imageUrl && (
            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <img src={imageUrl} alt="Ảnh danh sách" className="w-16 h-16 object-cover stamp-border" />
              <Btn size="sm" onClick={runOCR} disabled={ocrBusy}>
                {ocrBusy ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                {ocrBusy ? "Đang đọc ảnh…" : "Đọc dữ liệu từ ảnh"}
              </Btn>
            </div>
          )}
          {ocrNotConfigured && (
            <div className="f-body text-xs mt-3 p-2.5" style={{ background: "#F7E3E6", color: T.red, borderLeft: `3px solid ${T.red}` }}>
              Chưa cấu hình tính năng đọc ảnh (OCR) trên máy chủ. Cần thêm file API <code>api/ocr-students.js</code> và
              biến môi trường <code>ANTHROPIC_API_KEY</code> trong cài đặt dự án trên Vercel rồi triển khai lại.
              Trong lúc chờ cấu hình, bạn có thể dùng cách "Từ file Excel/CSV" ở trên — làm được ngay, không cần AI.
            </div>
          )}
          {ocrErr && <div className="f-body text-xs mt-2" style={{ color: T.red }}>{ocrErr}</div>}
        </div>
      )}

      {previewRows.length > 0 && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2 mt-4 mb-1.5">
            <span className="f-mono text-[11px] uppercase tracking-widest" style={{ color: T.amberDark }}>
              Xem trước — tick chọn dòng cần lấy ({checkedCount}/{previewRows.length})
            </span>
          </div>

          <div className="stamp-border p-2.5 mb-2.5 flex flex-wrap items-end gap-2" style={{ background: T.paper }}>
            <div className="flex gap-1.5">
              <Btn size="sm" variant="outline" onClick={selectAllRows}>Chọn tất cả</Btn>
              <Btn size="sm" variant="outline" onClick={clearAllRows}>Bỏ chọn tất cả</Btn>
            </div>
            <div className="w-px self-stretch mx-0.5" style={{ background: T.paperDark }} />
            {khoaOptions.length > 0 && (
              <div>
                <div className="f-body text-[9.5px] uppercase tracking-wider mb-0.5" style={{ color: T.inkSoft }}>Khoá</div>
                <select className={inputCls} style={{ ...inputStyle, fontSize: "11.5px", padding: "4px 6px", width: "auto" }} value={qKhoa} onChange={(e) => setQKhoa(e.target.value)}>
                  <option value="">— Tất cả —</option>
                  {khoaOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}
            {lopOptions.length > 0 && (
              <div>
                <div className="f-body text-[9.5px] uppercase tracking-wider mb-0.5" style={{ color: T.inkSoft }}>Lớp / Trung đội</div>
                <select className={inputCls} style={{ ...inputStyle, fontSize: "11.5px", padding: "4px 6px", width: "auto" }} value={qLop} onChange={(e) => setQLop(e.target.value)}>
                  <option value="">— Tất cả —</option>
                  {lopOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}
            {namHocOptions.length > 0 && (
              <div>
                <div className="f-body text-[9.5px] uppercase tracking-wider mb-0.5" style={{ color: T.inkSoft }}>Năm học</div>
                <select className={inputCls} style={{ ...inputStyle, fontSize: "11.5px", padding: "4px 6px", width: "auto" }} value={qNamHoc} onChange={(e) => setQNamHoc(e.target.value)}>
                  <option value="">— Tất cả —</option>
                  {namHocOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}
            {(khoaOptions.length > 0 || lopOptions.length > 0 || namHocOptions.length > 0) && (
              <div className="flex gap-1.5 items-center">
                <Btn size="sm" onClick={selectByQuick} disabled={!qKhoa && !qLop && !qNamHoc}>Chọn theo tiêu chí ({quickMatchCount})</Btn>
                <Btn size="sm" variant="outline" onClick={deselectByQuick} disabled={!qKhoa && !qLop && !qNamHoc}>Bỏ chọn tiêu chí</Btn>
              </div>
            )}
          </div>
          <div className="overflow-x-auto overflow-y-auto stamp-border" style={{ background: "#fff", maxHeight: 320 }}>
            <table className="w-full text-xs f-body table-lines table-grid">
              <thead>
                <tr className="f-mono text-[10px] uppercase tracking-wider" style={{ background: T.green, color: T.paper, position: "sticky", top: 0, zIndex: 1 }}>
                  <th className="px-2 py-1.5 w-8"></th>
                  <th className="text-left px-2 py-1.5">STT</th>
                  <th className="text-left px-2 py-1.5">Mã SV</th>
                  <th className="text-left px-2 py-1.5 min-w-[110px]">Họ và tên</th>
                  <th className="text-left px-2 py-1.5">Giới tính</th>
                  <th className="text-left px-2 py-1.5">Khoá</th>
                  <th className="text-left px-2 py-1.5">Lớp</th>
                  <th className="text-left px-2 py-1.5">Năm học</th>
                  <th className="text-left px-2 py-1.5">Ngày sinh</th>
                  <th className="text-left px-2 py-1.5">SĐT</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 ? T.paper : "#fff" }}>
                    <td className="px-2 py-1.5 text-center"><input type="checkbox" checked={Boolean(selectedRows[i])} onChange={() => toggleRow(i)} /></td>
                    {srcMode === "image" ? (
                      <>
                        <td className="px-1 py-1"><input className={inputCls} style={{ ...inputStyle, fontSize: "11px", padding: "3px 5px", width: 44 }} value={r.stt} onChange={(e) => editOcrRow(i, "stt", e.target.value)} /></td>
                        <td className="px-1 py-1"><input className={inputCls} style={{ ...inputStyle, fontSize: "11px", padding: "3px 5px", width: 70 }} value={r.msv} onChange={(e) => editOcrRow(i, "msv", e.target.value)} /></td>
                        <td className="px-1 py-1"><input className={inputCls} style={{ ...inputStyle, fontSize: "11px", padding: "3px 5px", minWidth: 110 }} value={r.name} onChange={(e) => editOcrRow(i, "name", e.target.value)} /></td>
                        <td className="px-1 py-1"><input className={inputCls} style={{ ...inputStyle, fontSize: "11px", padding: "3px 5px", width: 60 }} value={r.gender} onChange={(e) => editOcrRow(i, "gender", e.target.value)} /></td>
                        <td className="px-1 py-1"><input className={inputCls} style={{ ...inputStyle, fontSize: "11px", padding: "3px 5px", width: 55 }} value={r.khoa} onChange={(e) => editOcrRow(i, "khoa", e.target.value)} /></td>
                        <td className="px-1 py-1"><input className={inputCls} style={{ ...inputStyle, fontSize: "11px", padding: "3px 5px", width: 70 }} value={r.lop} onChange={(e) => editOcrRow(i, "lop", e.target.value)} /></td>
                        <td className="px-1 py-1"><input className={inputCls} style={{ ...inputStyle, fontSize: "11px", padding: "3px 5px", width: 70 }} value={r.namHoc} onChange={(e) => editOcrRow(i, "namHoc", e.target.value)} /></td>
                        <td className="px-1 py-1"><input className={inputCls} style={{ ...inputStyle, fontSize: "11px", padding: "3px 5px", width: 90 }} value={r.dob} onChange={(e) => editOcrRow(i, "dob", e.target.value)} /></td>
                        <td className="px-1 py-1"><input className={inputCls} style={{ ...inputStyle, fontSize: "11px", padding: "3px 5px", width: 90 }} value={r.phone} onChange={(e) => editOcrRow(i, "phone", e.target.value)} /></td>
                      </>
                    ) : (
                      <>
                        <td className="px-2 py-1.5 f-mono">{r.stt || "—"}</td>
                        <td className="px-2 py-1.5 f-mono">{r.msv || "—"}</td>
                        <td className="px-2 py-1.5 font-medium">
                          {r.name || <span className="italic" style={{ color: T.inkSoft }}>(thiếu tên — sẽ bị bỏ qua)</span>}
                          {isDup(r) && <span className="ml-1.5 f-mono text-[9.5px]" style={{ color: T.red }}>· Trùng đã có</span>}
                        </td>
                        <td className="px-2 py-1.5">{r.gender || "—"}</td>
                        <td className="px-2 py-1.5 f-mono">{r.khoa || "—"}</td>
                        <td className="px-2 py-1.5">{r.lop || "—"}</td>
                        <td className="px-2 py-1.5">{r.namHoc || "—"}</td>
                        <td className="px-2 py-1.5 f-mono">{formatDob(r.dob) || "—"}</td>
                        <td className="px-2 py-1.5 f-mono">{r.phone || "—"}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Btn onClick={confirmImport} disabled={checkedCount === 0}>
              <CheckCircle2 size={14} /> Xác nhận, thêm {checkedCount} sinh viên
            </Btn>
            <Btn variant="outline" onClick={onClose}>Huỷ</Btn>
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   TAB: TỔNG QUAN
   ============================================================ */
function DashboardTab({ perm, onNavigate }) {
  const { items: rooms, loading: roomsLoading } = useSharedList("rooms");
  const { items: students, loading: studentsLoading } = useSharedList("students");
  const { items: maint, loading: maintLoading } = useSharedList("maintenance");
  const { items: assets, loading: assetsLoading } = useSharedList("assets");

  const loading = roomsLoading || studentsLoading || maintLoading || assetsLoading;
  const [viewBuildingFree, setViewBuildingFree] = useState(null); // Toà đang xem chi tiết phòng/giường còn trống

  // Chỉ cho bấm/xem mục nào mà vai trò hiện tại thực sự được xem (dùng chung TAB_ROLES khai báo bên dưới).
  const isAllowed = (tabId) => (TAB_ROLES[tabId] || []).includes(perm.role);
  const goIfAllowed = (tabId) => (onNavigate && isAllowed(tabId) ? () => onNavigate(tabId) : undefined);

  const totalCapacity = rooms.reduce((s, r) => s + (Number(r.capacity) || 0), 0);
  const activeStudents = students.filter((s) => s.status !== "Đã trả phòng");
  const totalStudents = students.length;
  const occupiedCount = activeStudents.filter((s) => s.roomId).length;
  const roomOccCount = {};
  activeStudents.forEach((s) => { if (s.roomId) roomOccCount[s.roomId] = (roomOccCount[s.roomId] || 0) + 1; });
  const byStatus = ROOM_STATUS.reduce((acc, s) => {
    acc[s] = rooms.filter((r) => effectiveRoomStatus(r, roomOccCount[r.id] || 0) === s).length;
    return acc;
  }, {});
  const unassigned = activeStudents.filter((s) => !s.roomId).length;
  const pendingMaint = maint.filter((m) => m.status === "Chờ xử lý" || m.status === "Đang xử lý").length;
  const brokenAssets = assets.filter((a) => a.status === "Hỏng").length;
  // Thống kê chi tiết theo từng trạng thái — để khối "Bảo trì & Tài sản" ở Tổng quan không chỉ gộp 1 con số.
  const maintByStatus = MAINT_STATUS.reduce((acc, s) => { acc[s] = maint.filter((m) => m.status === s).length; return acc; }, {});
  const assetByStatus = ASSET_STATUS.reduce((acc, s) => { acc[s] = assets.filter((a) => a.status === s).length; return acc; }, {});

  const StatCard = ({ icon: Icon, label, value, accent, onClick }) => (
    <div
      className={`stamp-border p-4 card-item ${onClick ? "cursor-pointer" : ""}`}
      style={{ background: "#fff" }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="icon-badge" style={{ background: accent || T.green, color: "#fff" }}><Icon size={14} /></span>
        <span className="f-mono text-[10.5px] uppercase tracking-widest" style={{ color: T.inkSoft }}>{label}</span>
      </div>
      <div className="f-display text-3xl font-semibold" style={{ color: T.green }}>{value}</div>
    </div>
  );

  // Thống kê theo từng tòa nhà: số phòng, sức chứa, đang ở, còn trống, bảo trì
  const buildings = [...new Set(rooms.map((r) => r.building || "Chưa rõ").filter(Boolean))];
  const buildingStats = buildings.map((b) => {
    const bRooms = rooms.filter((r) => (r.building || "Chưa rõ") === b);
    const cap = bRooms.reduce((s, r) => s + (Number(r.capacity) || 0), 0);
    const occ = activeStudents.filter((s) => bRooms.some((r) => r.id === s.roomId)).length;
    return {
      building: b,
      roomCount: bRooms.length,
      capacity: cap,
      occupied: occ,
      free: bRooms.filter((r) => effectiveRoomStatus(r, roomOccCount[r.id] || 0) === "Trống").length,
      maintenance: bRooms.filter((r) => effectiveRoomStatus(r, roomOccCount[r.id] || 0) === "Đang bảo trì").length,
    };
  });

  const freeRoomsList = viewBuildingFree
    ? rooms
        .filter((r) => (r.building || "Chưa rõ") === viewBuildingFree)
        .map((r) => {
          const occ = roomOccCount[r.id] || 0;
          const cap = Number(r.capacity) || 0;
          return { room: r, occ, cap, free: Math.max(cap - occ, 0) };
        })
        .filter((x) => x.free > 0 && effectiveRoomStatus(x.room, x.occ) !== "Đang bảo trì")
        .sort((a, b) => naturalCompare(a.room.area || "", b.room.area || "") || naturalCompare(String(a.room.roomNumber || ""), String(b.room.roomNumber || "")))
    : [];

  return (
    <div>
      <SectionHeader icon={LayoutGrid} eyebrow="Tổng quan" title="Bảng điều khiển ký túc xá" />
      {loading ? <LoadingRow /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {isAllowed("students") && <StatCard icon={Users} label="Tổng số học viên" value={totalStudents} onClick={goIfAllowed("students")} />}
            <StatCard icon={Building2} label="Tổng số phòng" value={rooms.length} onClick={goIfAllowed("rooms")} />
            <StatCard icon={BedDouble} label="Phòng đang sử dụng" value={byStatus["Đang ở"] || 0} accent={T.amberDark} onClick={goIfAllowed("rooms")} />
            <StatCard icon={DoorOpen} label="Phòng còn trống" value={byStatus["Trống"] || 0} accent={T.green} onClick={goIfAllowed("rooms")} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard icon={Wrench} label="Phòng bảo trì" value={byStatus["Đang bảo trì"] || 0} accent={T.red} onClick={goIfAllowed("rooms")} />
            <StatCard icon={ClipboardCheck} label="Yêu cầu sửa chữa" value={pendingMaint} accent={T.red} onClick={goIfAllowed("maintenance")} />
            {isAllowed("assets") && <StatCard icon={AlertTriangle} label="Tài sản hỏng" value={brokenAssets} accent={T.red} onClick={goIfAllowed("assets")} />}
            {isAllowed("assignment") && <StatCard icon={AlertTriangle} label="SV chưa xếp phòng" value={unassigned} accent={T.amberDark} onClick={goIfAllowed("assignment")} />}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="stamp-border p-4" style={{ background: "#fff" }}>
              <div className="f-display text-sm uppercase tracking-wider mb-3" style={{ color: T.amberDark }}>Trạng thái phòng</div>
              <div className="space-y-2">
                {ROOM_STATUS.map((s) => (
                  <div key={s} className="flex items-center justify-between f-body text-sm">
                    <span style={{ color: T.ink }}>{s}</span>
                    <span className="f-mono font-semibold" style={{ color: T.green }}>{byStatus[s] || 0}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between f-body text-sm pt-1" style={{ borderTop: `1px dashed ${T.paperDark}` }}>
                  <span style={{ color: T.inkSoft }}>Tổng sức chứa (toàn bộ giường)</span>
                  <span className="f-mono font-semibold" style={{ color: T.green }}>{totalCapacity}</span>
                </div>
                <div className="flex items-center justify-between f-body text-sm">
                  <span style={{ color: T.inkSoft }}>Đang có người ở (thực tế)</span>
                  <span className="f-mono font-semibold" style={{ color: T.amberDark }}>{occupiedCount}</span>
                </div>
                <div className="flex items-center justify-between f-body text-sm">
                  <span style={{ color: T.inkSoft }}>Giường còn trống</span>
                  <span className="f-mono font-semibold" style={{ color: T.green }}>{Math.max(totalCapacity - occupiedCount, 0)}</span>
                </div>
              </div>
            </div>
            <div className="stamp-border p-4" style={{ background: "#fff" }}>
              <div className="f-display text-sm uppercase tracking-wider mb-3" style={{ color: T.amberDark }}>Bảo trì & tài sản</div>

              <div className="f-mono text-[11px] font-bold uppercase tracking-widest mb-1.5 pb-1" style={{ color: T.green, borderBottom: `1.5px solid ${T.green}` }}>Yêu cầu sửa chữa</div>
              <div className="space-y-1 mb-3">
                {MAINT_STATUS.map((s) => (
                  <div key={s} className="flex items-center justify-between f-body text-sm">
                    <span style={{ color: T.ink }}>{s}</span>
                    <span className="f-mono font-semibold" style={{ color: s === "Chờ xử lý" ? T.red : s === "Đang xử lý" ? T.amberDark : T.green }}>{maintByStatus[s] || 0}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between f-body text-sm pt-1" style={{ borderTop: `1px dashed ${T.paperDark}` }}>
                  <span style={{ color: T.inkSoft }}>Tổng số yêu cầu đã ghi nhận</span>
                  <span className="f-mono font-semibold" style={{ color: T.green }}>{maint.length}</span>
                </div>
              </div>

              {isAllowed("assets") && (
                <>
                  <div className="f-mono text-[11px] font-bold uppercase tracking-widest mb-1.5 pb-1" style={{ color: T.amberDark, borderBottom: `1.5px solid ${T.amberDark}` }}>Tài sản</div>
                  <div className="space-y-1">
                    {ASSET_STATUS.map((s) => (
                      <div key={s} className="flex items-center justify-between f-body text-sm">
                        <span style={{ color: T.ink }}>{s}</span>
                        <span className="f-mono font-semibold" style={{ color: s === "Hỏng" ? T.red : s === "Đang sửa" ? T.amberDark : T.green }}>{assetByStatus[s] || 0}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between f-body text-sm pt-1" style={{ borderTop: `1px dashed ${T.paperDark}` }}>
                      <span style={{ color: T.inkSoft }}>Tổng số tài sản</span>
                      <span className="f-mono font-semibold" style={{ color: T.green }}>{assets.length}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="stamp-border p-4" style={{ background: "#fff" }}>
            <div className="f-display text-sm uppercase tracking-wider mb-3" style={{ color: T.amberDark }}>Thống kê theo tòa nhà</div>
            {buildingStats.length === 0 ? <EmptyState text="Chưa có dữ liệu tòa nhà / phòng." /> : (
              <div className="overflow-x-auto stamp-border" style={{ background: "#fff" }}>
                <table className="w-full text-sm f-body table-lines table-grid" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
                  <thead>
                    <tr className="f-mono text-[10.5px] uppercase tracking-wider" style={{ background: T.green, color: T.paper }}>
                      <th className="text-center px-3 py-2">Tòa nhà</th>
                      <th className="text-center px-3 py-2">Số phòng</th>
                      <th className="text-center px-3 py-2">Sức chứa</th>
                      <th className="text-center px-3 py-2">Đang ở</th>
                      <th className="text-center px-3 py-2">Còn trống</th>
                      <th className="text-center px-3 py-2">Bảo trì</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buildingStats.map((b, i) => {
                      const freeBeds = Math.max(b.capacity - b.occupied, 0);
                      return (
                        <tr key={b.building} style={{ background: i % 2 ? T.paper : "#fff" }}>
                          <td className="text-center px-3 py-2 font-medium" style={{ color: T.green }}>{b.building}</td>
                          <td className="text-center px-3 py-2 f-mono">{b.roomCount}</td>
                          <td className="text-center px-3 py-2 f-mono">{b.capacity}</td>
                          <td className="text-center px-3 py-2 f-mono" style={{ color: T.amberDark }}>{b.occupied}</td>
                          <td className="text-center px-3 py-2 f-mono">
                            {b.free > 0 || freeBeds > 0 ? (
                              <button
                                type="button"
                                onClick={() => setViewBuildingFree(b.building)}
                                className="btn-press"
                                style={{ color: T.green }}
                              >
                                <div className="font-semibold underline underline-offset-2">
                                  {b.free} ({freeBeds} giường trống)
                                </div>
                                <div className="f-body italic" style={{ color: T.inkSoft, fontSize: 10 }}>chạm để xem chi tiết</div>
                              </button>
                            ) : (
                              <div>{b.free} (0 giường trống)</div>
                            )}
                          </td>
                          <td className="text-center px-3 py-2 f-mono" style={{ color: b.maintenance > 0 ? T.red : T.inkSoft }}>{b.maintenance}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {viewBuildingFree && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(19,31,25,0.55)" }} onClick={() => setViewBuildingFree(null)}>
          <div className="stamp-border p-5 w-full max-w-lg" style={{ background: "#fff", maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <div className="f-display text-sm uppercase tracking-wider" style={{ color: T.amberDark }}>
                Giường còn trống — Toà {viewBuildingFree}
              </div>
              <button onClick={() => setViewBuildingFree(null)}><X size={16} style={{ color: T.inkSoft }} /></button>
            </div>
            {freeRoomsList.length === 0 ? (
              <div className="f-body text-sm italic mt-3" style={{ color: T.inkSoft }}>Toà này hiện không còn giường trống nào.</div>
            ) : (
              <>
                <div className="f-body text-xs mb-3" style={{ color: T.inkSoft }}>
                  Tổng cộng còn <span className="font-semibold" style={{ color: T.green }}>{freeRoomsList.reduce((s, x) => s + x.free, 0)}</span> giường trống, ở {freeRoomsList.length} phòng.
                </div>
                <div className="space-y-1.5">
                  {freeRoomsList.map(({ room, occ, cap, free }) => (
                    <div key={room.id} className="flex items-center justify-between px-3 py-2 rounded-sm" style={{ background: "rgba(31,51,40,0.04)", border: `1px solid ${T.paperDark}` }}>
                      <div>
                        <div className="f-body text-sm font-medium" style={{ color: T.green }}>{roomLabel(room)}</div>
                        <div className="f-mono text-[10px]" style={{ color: T.inkSoft }}>{room.area ? `${room.area} · ` : ""}{room.gender || "Nam"}</div>
                      </div>
                      <div className="text-right">
                        <div className="f-mono text-sm font-semibold" style={{ color: T.green }}>{free} trống</div>
                        <div className="f-mono text-[10px]" style={{ color: T.inkSoft }}>{occ}/{cap} đang ở</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="mt-4">
              <Btn variant="outline" onClick={() => setViewBuildingFree(null)}>Đóng</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   TAB: DANH SÁCH PHÒNG (theo tòa nhà, khu vực, trạng thái sử dụng)
   ============================================================ */
function RoomForm({ initial, onCancel, onSave, warn }) {
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial]);
  return (
    <div className="stamp-border p-4 mb-5 grid grid-cols-1 md:grid-cols-3 gap-3" style={{ background: "#fff" }}>
      <div className="md:col-span-3"><FormWarning message={warn} /></div>
      <Field label="Toà nhà" required>
        <input className={inputCls} style={inputStyle} value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} placeholder="VD: Nhà A" />
      </Field>
      <Field label="Khu vực / Tầng">
        <input className={inputCls} style={inputStyle} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="VD: Tầng 3, khu B" />
      </Field>
      <Field label="Số phòng" required>
        <input className={inputCls} style={inputStyle} value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} placeholder="VD: 301" />
      </Field>
      <Field label="Sức chứa (số giường)" required>
        <input type="number" min="1" className={inputCls} style={inputStyle} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
      </Field>
      <Field label="Giới tính phòng">
        <select className={inputCls} style={inputStyle} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
          {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </Field>
      <Field label="Trạng thái sử dụng">
        <select className={inputCls} style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          {ROOM_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <div className="md:col-span-3">
        <Field label="Ghi chú"><input className={inputCls} style={inputStyle} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
      </div>
      <div className="md:col-span-3">
        <Field label="Ảnh phòng (tuỳ chọn)">
          <UploadField onUploaded={(url) => setForm((f) => ({ ...f, imageUrl: url }))} />
          {form.imageUrl && (
            <div className="flex items-center gap-2 mt-2">
              <img src={form.imageUrl} alt="Ảnh phòng" className="w-24 h-24 object-cover stamp-border" />
              <button type="button" onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))} className="f-mono text-[10px] underline" style={{ color: T.red }}>Xoá ảnh</button>
            </div>
          )}
        </Field>
      </div>
      <div className="md:col-span-3 flex gap-2">
        <Btn onClick={() => onSave(form)}>Lưu</Btn>
        <Btn variant="outline" onClick={onCancel}>Huỷ</Btn>
      </div>
    </div>
  );
}

/* ============ NHẬP DANH SÁCH PHÒNG TỪ EXCEL/CSV ============ */
function guessRoomField(header) {
  const h = String(header || "").toLowerCase();
  if (/toà\s*nhà|tòa\s*nhà|^nhà$|building/.test(h)) return "building";
  if (/tầng|khu\s*vực|area|floor/.test(h)) return "area";
  if (/số\s*phòng|^phòng$|room/.test(h)) return "roomNumber";
  if (/sức\s*chứa|số\s*giường|capacity/.test(h)) return "capacity";
  if (/giới\s*tính|gender/.test(h)) return "gender";
  if (/trạng\s*thái|status/.test(h)) return "status";
  if (/ghi\s*chú|note/.test(h)) return "note";
  return "";
}
const ROOM_IMPORT_FIELDS = [
  { key: "", label: "— Bỏ qua cột này —" },
  { key: "building", label: "Toà nhà" },
  { key: "area", label: "Tầng / khu vực" },
  { key: "roomNumber", label: "Số phòng" },
  { key: "capacity", label: "Sức chứa" },
  { key: "gender", label: "Giới tính phòng" },
  { key: "status", label: "Trạng thái" },
  { key: "note", label: "Ghi chú" },
];

function RoomImportPanel({ existingItems, onConfirm, onClose }) {
  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [colMap, setColMap] = useState([]);
  const [fileErr, setFileErr] = useState("");
  const [fileBusy, setFileBusy] = useState(false);
  const [selectedRows, setSelectedRows] = useState({});

  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileErr(""); setFileBusy(true);
    try {
      const isCsv = /\.csv$/i.test(file.name);
      let rows = [];
      if (isCsv) {
        rows = parseCSVText(await file.text());
      } else {
        const XLSX = await loadXLSXLib();
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" })
          .map((r) => r.map((c) => String(c ?? "")))
          .filter((r) => r.some((c) => String(c).trim() !== ""));
      }
      if (rows.length === 0) { setFileErr("Không đọc được dữ liệu nào từ file này."); setFileBusy(false); return; }
      const colCount = Math.max(...rows.map((r) => r.length));
      const headerRow = rows[0] || [];
      setColMap(Array.from({ length: colCount }, (_, i) => guessRoomField(headerRow[i])));
      setRawRows(rows);
      setFileName(file.name);
      setSelectedRows({});
    } catch (err) {
      setFileErr(`Đọc file thất bại — ${err?.message || err}`);
    }
    setFileBusy(false);
  };

  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
  const previewRows = dataRows.map((r) => {
    const o = { building: "", area: "", roomNumber: "", capacity: "", gender: "", status: "", note: "" };
    colMap.forEach((key, i) => { if (key && r[i] !== undefined) o[key] = String(r[i]).trim(); });
    if (o.gender) o.gender = normalizeGenderInput(o.gender);
    if (!ROOM_STATUS.includes(o.status)) o.status = "Trống";
    return o;
  });

  const existingSet = new Set(existingItems.map((r) => normalizeName(`${r.building}|${r.roomNumber}`)));
  const isDup = (r) => r.building && r.roomNumber && existingSet.has(normalizeName(`${r.building}|${r.roomNumber}`));

  useEffect(() => {
    const next = {};
    previewRows.forEach((r, i) => { next[i] = Boolean(r.building && r.roomNumber) && !isDup(r); });
    setSelectedRows(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewRows.length]);

  const toggleRow = (i) => setSelectedRows((s) => ({ ...s, [i]: !s[i] }));
  const checkedCount = Object.values(selectedRows).filter(Boolean).length;

  const confirmImport = () => {
    const chosen = previewRows.filter((r, i) => selectedRows[i] && r.building && r.roomNumber);
    if (chosen.length === 0) return;
    onConfirm(chosen.map((r, idx) => ({
      id: Date.now() + idx,
      building: r.building,
      area: r.area || "",
      roomNumber: r.roomNumber,
      capacity: r.capacity || "4",
      gender: r.gender || "Nam",
      status: r.status || "Trống",
      note: r.note || "",
    })));
  };

  return (
    <div className="stamp-border p-3 mb-3" style={{ background: "#fff" }}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <span className="f-display text-[11.5px] uppercase tracking-wider" style={{ color: T.amberDark }}>Nhập danh sách phòng từ Excel/CSV</span>
        <button onClick={onClose} title="Đóng"><X size={16} style={{ color: T.inkSoft }} /></button>
      </div>
      <p className="f-body text-[11px] italic mb-2" style={{ color: T.inkSoft }}>
        Chọn file Excel (.xlsx/.xls) hoặc CSV — đọc trực tiếp trong trình duyệt. Sau khi đọc xong, chọn cột nào ứng với thông tin nào rồi tick dòng cần lấy.
      </p>
      <label className="f-display text-[11px] uppercase tracking-wider px-3 py-1.5 inline-flex items-center gap-1.5 cursor-pointer btn-press" style={{ border: `1px solid ${T.green}`, color: T.green }}>
        {fileBusy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
        {fileBusy ? "Đang đọc file…" : "Chọn file từ máy"}
        <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFilePicked} />
      </label>
      {fileName && <span className="f-body text-[11px] ml-2" style={{ color: T.inkSoft }}>Đã chọn: {fileName}</span>}
      {fileErr && <div className="f-body text-xs mt-2" style={{ color: T.red }}>{fileErr}</div>}

      {rawRows.length > 0 && (
        <>
          <label className="flex items-center gap-2 mt-3 f-body text-xs cursor-pointer" style={{ color: T.ink }}>
            <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
            Dòng đầu tiên là tiêu đề cột (không lấy làm dữ liệu)
          </label>
          <div className="f-mono text-[10.5px] uppercase tracking-widest mt-3 mb-1" style={{ color: T.amberDark }}>Chọn cột nào ứng với thông tin nào</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-3">
            {colMap.map((val, i) => (
              <div key={i}>
                <div className="f-body text-[10px] truncate mb-0.5" style={{ color: T.inkSoft }} title={rawRows[0]?.[i]}>
                  Cột {i + 1}{hasHeader && rawRows[0]?.[i] ? `: "${rawRows[0][i]}"` : ""}
                </div>
                <select className={inputCls} style={{ ...inputStyle, fontSize: "11.5px", padding: "4px 6px" }} value={val} onChange={(e) => setColMap((cm) => cm.map((v, ci) => (ci === i ? e.target.value : v)))}>
                  {ROOM_IMPORT_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </>
      )}

      {previewRows.length > 0 && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2 mt-4 mb-1.5">
            <span className="f-mono text-[11px] uppercase tracking-widest" style={{ color: T.amberDark }}>Xem trước — tick chọn dòng cần lấy ({checkedCount}/{previewRows.length})</span>
          </div>
          <div className="overflow-x-auto overflow-y-auto stamp-border" style={{ background: "#fff", maxHeight: 320 }}>
            <table className="w-full text-xs f-body table-lines table-grid">
              <thead>
                <tr className="f-mono text-[10px] uppercase tracking-wider" style={{ background: T.green, color: T.paper, position: "sticky", top: 0, zIndex: 1 }}>
                  <th className="px-2 py-1.5 w-8"></th>
                  <th className="text-left px-2 py-1.5">Toà nhà</th>
                  <th className="text-left px-2 py-1.5">Tầng/Khu vực</th>
                  <th className="text-left px-2 py-1.5">Số phòng</th>
                  <th className="text-left px-2 py-1.5">Sức chứa</th>
                  <th className="text-left px-2 py-1.5">Giới tính</th>
                  <th className="text-left px-2 py-1.5">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 ? T.paper : "#fff" }}>
                    <td className="px-2 py-1.5 text-center"><input type="checkbox" checked={Boolean(selectedRows[i])} onChange={() => toggleRow(i)} /></td>
                    <td className="px-2 py-1.5 font-medium">
                      {r.building || <span className="italic" style={{ color: T.inkSoft }}>(thiếu — sẽ bị bỏ qua)</span>}
                      {isDup(r) && <span className="ml-1.5 f-mono text-[9.5px]" style={{ color: T.red }}>· Trùng đã có</span>}
                    </td>
                    <td className="px-2 py-1.5">{r.area || "—"}</td>
                    <td className="px-2 py-1.5 f-mono">{r.roomNumber || "—"}</td>
                    <td className="px-2 py-1.5 f-mono">{r.capacity || "—"}</td>
                    <td className="px-2 py-1.5">{r.gender || "—"}</td>
                    <td className="px-2 py-1.5">{r.status || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Btn onClick={confirmImport} disabled={checkedCount === 0}><CheckCircle2 size={14} /> Xác nhận, thêm {checkedCount} phòng</Btn>
            <Btn variant="outline" onClick={onClose}>Huỷ</Btn>
          </div>
        </>
      )}
    </div>
  );
}

function RoomsTab({ perm }) {
  const { items: rooms, setItems: setRooms, loading } = useSharedList("rooms");
  const { items: students, setItems: setStudents } = useSharedList("students");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [warn, setWarn] = useState("");
  const [filterBuilding, setFilterBuilding] = useState("");
  const [filterArea, setFilterArea] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [mergeFrom, setMergeFrom] = useState(null);
  const [mergeTarget, setMergeTarget] = useState("");
  const [mergeReason, setMergeReason] = useState("");
  const [maintTarget, setMaintTarget] = useState(null); // Phòng đang có SV ở, đang chờ xác nhận lý do trước khi đánh dấu bảo trì
  const [maintReason, setMaintReason] = useState("");
  const [maintNote, setMaintNote] = useState("");
  const [renamingBuilding, setRenamingBuilding] = useState(null); // Tên toà nhà (cũ) đang được đổi tên inline
  const [renameValue, setRenameValue] = useState("");
  const [viewStudentId, setViewStudentId] = useState(null); // Đang xem đầy đủ thông tin 1 học viên trong phòng
  const [swapStudent, setSwapStudent] = useState(null); // Đang đổi giường cho học viên này với 1 bạn cùng phòng
  // action = { bed, swapWithId }: chuyển học viên sang "bed"; nếu "bed" đó đang có người (swapWithId) thì
  // người đó nhận lại giường cũ của học viên — còn nếu giường trống thì chỉ chuyển 1 chiều.
  const confirmSwap = async (student, action) => {
    await setStudents(students.map((s) => {
      if (s.id === student.id) return { ...s, bed: action.bed };
      if (action.swapWithId && s.id === action.swapWithId) return { ...s, bed: student.bed };
      return s;
    }));
    setSwapStudent(null);
  };

  // Gán giường cho những học viên đang ở trong phòng nhưng chưa có số giường (dữ liệu cũ nhập tay/import
  // trước đây bỏ trống) — chọn giường trống nhỏ nhất còn lại trong đúng phòng của từng người.
  const autoAssignRoomBeds = async (room) => {
    const occ = students.filter((s) => s.roomId === room.id && s.status !== "Đã trả phòng");
    const usedBeds = new Set(occ.map((s) => String(s.bed)).filter(Boolean));
    const updates = {};
    occ.filter((s) => !s.bed).forEach((s) => {
      const bed = pickFreeBed(room.capacity, usedBeds);
      if (bed) { updates[s.id] = bed; usedBeds.add(bed); }
    });
    if (Object.keys(updates).length === 0) return;
    await setStudents(students.map((s) => (updates[s.id] ? { ...s, bed: updates[s.id] } : s)));
  };
  // Quét toàn bộ ký túc xá, gán giường còn thiếu cho mọi phòng cùng lúc.
  const autoAssignAllBeds = async () => {
    const usedBedsByRoom = {};
    rooms.forEach((r) => {
      usedBedsByRoom[r.id] = new Set(
        students.filter((s) => s.roomId === r.id && s.status !== "Đã trả phòng").map((s) => String(s.bed)).filter(Boolean)
      );
    });
    const updates = {};
    students.forEach((s) => {
      if (!s.roomId || s.status === "Đã trả phòng" || s.bed) return;
      const room = rooms.find((r) => r.id === s.roomId);
      if (!room) return;
      const bed = pickFreeBed(room.capacity, usedBedsByRoom[room.id] || new Set());
      if (bed) { updates[s.id] = bed; (usedBedsByRoom[room.id] || (usedBedsByRoom[room.id] = new Set())).add(bed); }
    });
    if (Object.keys(updates).length === 0) return;
    await setStudents(students.map((s) => (updates[s.id] ? { ...s, bed: updates[s.id] } : s)));
  };

  const blankForm = { building: "", area: "", roomNumber: "", capacity: "4", gender: "Nam", status: "Trống", note: "", imageUrl: "" };

  const occupantsOf = (roomId) => students.filter((s) => s.roomId === roomId && s.status !== "Đã trả phòng");
  const viewStudent = viewStudentId ? students.find((s) => s.id === viewStudentId) : null;
  const viewStudentRoom = viewStudent ? rooms.find((r) => r.id === viewStudent.roomId) : null;

  const validate = (form) => !form.building.trim() || !form.roomNumber.trim() || !String(form.capacity).trim();

  const addRoom = async (form) => {
    if (validate(form)) { setWarn("Vui lòng nhập đủ Toà nhà, Số phòng và Sức chứa trước khi lưu."); return; }
    setWarn("");
    await setRooms([...rooms, { id: Date.now(), ...form }]);
    setShowForm(false);
  };
  const saveEdit = async (form) => {
    if (validate(form)) { setWarn("Vui lòng nhập đủ Toà nhà, Số phòng và Sức chứa trước khi lưu."); return; }
    setWarn("");
    await setRooms(rooms.map((r) => (r.id === editingId ? { ...r, ...form } : r)));
    setEditingId(null);
  };
  const removeRoom = async (id) => {
    if (occupantsOf(id).length > 0) { reportGlobalError("Không thể xoá phòng đang có sinh viên ở — hãy chuyển hoặc trả phòng cho sinh viên trước."); return; }
    await setRooms(rooms.filter((r) => r.id !== id));
  };
  const toggleStatus = async (r, status) => {
    await setRooms(rooms.map((x) => (x.id === r.id ? { ...x, status, ...(status !== "Đang bảo trì" ? { maintenanceReason: "", maintenanceNote: "" } : {}) } : x)));
  };

  // Phòng còn sinh viên thì không cho đánh dấu bảo trì ngay — bắt buộc chọn lý do (SV đang nghỉ lễ/Tết/hè,
  // đi thực tập, phòng hư hỏng gấp...) hoặc dồn sinh viên sang phòng khác trước. Phòng đã trống thì đánh dấu luôn.
  const requestMaintenance = (r) => {
    if (occupantsOf(r.id).length === 0) { toggleStatus(r, "Đang bảo trì"); return; }
    setMaintTarget(r); setMaintReason(""); setMaintNote("");
  };
  const confirmMaintenance = async () => {
    if (!maintTarget || !maintReason) return;
    await setRooms(rooms.map((x) => (x.id === maintTarget.id ? { ...x, status: "Đang bảo trì", maintenanceReason: maintReason, maintenanceNote: maintNote } : x)));
    setMaintTarget(null); setMaintReason(""); setMaintNote("");
  };

  // Đổi tên toà nhà — sửa lỗi chính tả/sai sót mà không phải sửa tay từng phòng.
  const renameBuilding = async (oldName, newNameRaw) => {
    const newName = (newNameRaw || "").trim();
    if (!newName) { reportGlobalError("Tên toà nhà không được để trống."); return; }
    if (newName === oldName) { setRenamingBuilding(null); return; }
    if (rooms.some((r) => (r.building || "") === newName)) {
      reportGlobalError(`Đã tồn tại toà nhà "${newName}" — hãy dùng chức năng dồn phòng nếu muốn gộp.`);
      return;
    }
    await setRooms(rooms.map((r) => ((r.building || "") === oldName ? { ...r, building: newName } : r)));
    if (filterBuilding === oldName) setFilterBuilding(newName);
    setRenamingBuilding(null);
  };

  const doMerge = async () => {
    if (!mergeFrom || !mergeTarget) return;
    if (!mergeReason) { reportGlobalError("Vui lòng chọn lý do dồn phòng trước khi xác nhận."); return; }
    const target = rooms.find((r) => r.id === Number(mergeTarget));
    if (!target) return;
    const moving = occupantsOf(mergeFrom.id);
    const already = occupantsOf(target.id).length;
    const room = target.capacity ? Number(target.capacity) : Infinity;
    if (already + moving.length > room) {
      reportGlobalError(`Phòng đích không đủ chỗ — còn trống ${Math.max(room - already, 0)} chỗ nhưng cần dồn ${moving.length} sinh viên.`);
      return;
    }
    const movingIds = new Set(moving.map((s) => s.id));
    const reasonNote = `Dồn phòng ngày ${new Date().toLocaleDateString("vi-VN")} từ ${roomLabel(mergeFrom)} — Lý do: ${mergeReason}`;
    await setStudents(students.map((s) => (movingIds.has(s.id) ? { ...s, roomId: target.id, bed: "", note: s.note ? `${s.note} | ${reasonNote}` : reasonNote } : s)));
    await setRooms(rooms.map((r) => (r.id === mergeFrom.id ? { ...r, status: "Trống", maintenanceReason: "", maintenanceNote: "" } : r)));
    setMergeFrom(null);
    setMergeTarget("");
    setMergeReason("");
  };

  const buildings = [...new Set(rooms.map((r) => r.building).filter(Boolean))].sort(naturalCompare);
  const areas = [...new Set(rooms.filter((r) => !filterBuilding || r.building === filterBuilding).map((r) => r.area).filter(Boolean))].sort(naturalCompare);
  const filteredRooms = rooms.filter((r) =>
    (!filterBuilding || r.building === filterBuilding) &&
    (!filterArea || r.area === filterArea) &&
    (!filterStatus || effectiveRoomStatus(r, occupantsOf(r.id).length) === filterStatus)
  );
  const UNKNOWN_BUILDING = "Chưa rõ toà nhà";
  const UNKNOWN_AREA = "Chưa rõ tầng/khu vực";
  const grouped = filteredRooms.reduce((acc, r) => {
    const k = r.building || UNKNOWN_BUILDING;
    (acc[k] = acc[k] || []).push(r);
    return acc;
  }, {});
  // Toà nhà xếp theo thứ tự tự nhiên (số trước chữ), toà chưa rõ luôn đẩy xuống cuối.
  const buildingKeys = Object.keys(grouped).sort((a, b) => {
    if (a === UNKNOWN_BUILDING) return 1;
    if (b === UNKNOWN_BUILDING) return -1;
    return naturalCompare(a, b);
  });
  // Nhóm phụ theo tầng/khu vực trong mỗi toà nhà, rồi sắp theo tầng, rồi theo số phòng — Toà nhà -> Tầng -> Phòng.
  const groupByArea = (list) => {
    const g = list.reduce((acc, r) => {
      const k = r.area || UNKNOWN_AREA;
      (acc[k] = acc[k] || []).push(r);
      return acc;
    }, {});
    return Object.entries(g)
      .sort(([a], [b]) => {
        if (a === UNKNOWN_AREA) return 1;
        if (b === UNKNOWN_AREA) return -1;
        return naturalCompare(a, b);
      })
      .map(([area, roomsInArea]) => [area, [...roomsInArea].sort((x, y) => naturalCompare(x.roomNumber, y.roomNumber))]);
  };

  const statusColor = { "Trống": T.green, "Đang ở": T.amberDark, "Đang bảo trì": T.red };

  return (
    <div>
      <SectionHeader compact icon={Building2} eyebrow={`Tổng số phòng: ${rooms.length}`} title="Danh sách phòng"
        action={perm.canManage && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Btn size="sm" variant="outline" onClick={autoAssignAllBeds}><Repeat size={14} /> Gán giường còn thiếu</Btn>
            <Btn size="sm" variant="outline" onClick={() => setShowImport((s) => !s)}><Upload size={14} /> Nhập từ Excel/CSV</Btn>
            <Btn size="sm" onClick={() => (showForm ? setShowForm(false) : setShowForm(true))}><Plus size={14} /> Thêm phòng</Btn>
          </div>
        )} />

      {perm.canManage && showImport && (
        <RoomImportPanel
          existingItems={rooms}
          onClose={() => setShowImport(false)}
          onConfirm={async (newRooms) => {
            await setRooms([...rooms, ...newRooms]);
            setShowImport(false);
          }}
        />
      )}

      {perm.canManage && showForm && (
        <RoomForm initial={blankForm} warn={warn} onCancel={() => setShowForm(false)} onSave={addRoom} />
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <select className={inputCls} style={{ ...inputStyle, width: "auto" }} value={filterBuilding} onChange={(e) => { setFilterBuilding(e.target.value); setFilterArea(""); }}>
          <option value="">— Tất cả toà nhà —</option>
          {buildings.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className={inputCls} style={{ ...inputStyle, width: "auto" }} value={filterArea} onChange={(e) => setFilterArea(e.target.value)}>
          <option value="">— Tất cả tầng / khu vực —</option>
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className={inputCls} style={{ ...inputStyle, width: "auto" }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">— Tất cả trạng thái —</option>
          {ROOM_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? <LoadingRow /> : filteredRooms.length === 0 ? <EmptyState text="Chưa có phòng nào phù hợp." /> : (
        <div className="space-y-4">
          {buildingKeys.map((building) => {
            const list = grouped[building];
            const areaGroups = groupByArea(list);
            return (
            <div key={building} className="stamp-border" style={{ background: "rgba(255,255,255,0.55)" }}>
              <div className="flex items-center gap-2 px-3 py-2 flex-wrap" style={{ background: T.green, borderBottom: `2px solid ${T.gold}` }}>
                <Building2 size={14} style={{ color: T.amber }} />
                {renamingBuilding === building ? (
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      autoFocus
                      className="f-body text-xs px-2 py-1 outline-none rounded-sm"
                      style={{ ...inputStyle, width: 160 }}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") renameBuilding(building, renameValue);
                        if (e.key === "Escape") setRenamingBuilding(null);
                      }}
                    />
                    <button type="button" title="Lưu" onClick={() => renameBuilding(building, renameValue)} className="p-1 rounded-sm" style={{ background: T.gold }}>
                      <CheckCircle2 size={13} style={{ color: T.greenDark }} />
                    </button>
                    <button type="button" title="Huỷ" onClick={() => setRenamingBuilding(null)} className="p-1 rounded-sm" style={{ background: "rgba(237,230,214,0.25)" }}>
                      <X size={13} style={{ color: T.paper }} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="f-display text-sm uppercase tracking-wider" style={{ color: T.paper }}>{building}</span>
                    {building !== UNKNOWN_BUILDING && perm.canManage && (
                      <button
                        type="button"
                        title="Sửa tên toà nhà"
                        onClick={() => { setRenamingBuilding(building); setRenameValue(building); }}
                        className="p-0.5 rounded-sm opacity-80 hover:opacity-100"
                      >
                        <Pencil size={12} style={{ color: T.amber }} />
                      </button>
                    )}
                  </>
                )}
                <span className="f-mono text-[10px]" style={{ color: "rgba(237,230,214,0.7)" }}>({list.length} phòng)</span>
              </div>
              <div className="p-2.5">
              {list.some((r) => editingId === r.id) && (
                <div className="mb-2.5 space-y-2">
                  {list.filter((r) => editingId === r.id).map((r) => (
                    <RoomForm
                      key={r.id}
                      initial={{ building: r.building, area: r.area || "", roomNumber: r.roomNumber, capacity: r.capacity, gender: r.gender || "Nam", status: r.status || "Trống", note: r.note || "", imageUrl: r.imageUrl || "" }}
                      warn={warn}
                      onCancel={() => setEditingId(null)}
                      onSave={saveEdit}
                    />
                  ))}
                </div>
              )}
              {/* Các tầng/khu vực xếp thành cột nằm cạnh nhau (tầng 2 bên phải tầng 1, tầng 3 bên phải tầng 2…),
                  cuộn ngang để xem hết các tầng. Trong mỗi tầng, phòng xếp dọc từ trên xuống theo số phòng
                  (101, 102, 103…), cuộn dọc riêng từng tầng nếu tầng có nhiều phòng. */}
              <div className="overflow-x-auto pb-1.5 scrollbar-thin">
                <div className="flex items-start gap-0" style={{ width: "max-content" }}>
                  {areaGroups.map(([area, areaList], areaIdx) => (
                    <div
                      key={area}
                      className="flex-shrink-0"
                      style={{
                        width: 208,
                        paddingLeft: areaIdx > 0 ? 14 : 0,
                        marginLeft: areaIdx > 0 ? 14 : 0,
                        borderLeft: areaIdx > 0 ? `2px dashed ${T.paperDark}` : "none",
                      }}
                    >
                      {areaGroups.length > 1 && (
                        <div
                          className="f-display text-[13px] font-bold uppercase tracking-wider mb-2 px-2.5 py-1.5 text-center rounded-sm"
                          style={{ color: T.paper, background: T.green, boxShadow: `inset 0 0 0 1px ${T.gold}` }}
                        >
                          {area}
                        </div>
                      )}
                      <div className="flex flex-col gap-2 overflow-y-auto scrollbar-thin pr-1" style={{ maxHeight: 236, minHeight: areaList.length > 0 ? 0 : "auto" }}>
                        {areaList.filter((r) => editingId !== r.id).map((r) => {
                          const occ = occupantsOf(r.id);
                          const cap = Number(r.capacity) || 0;
                          return (
                            <div key={r.id} className="stamp-border card-item p-3" style={{ background: "#fff" }}>

                              <div className="flex items-start justify-between gap-2">
                                <div className="cursor-pointer" onClick={() => setExpandedId((id) => (id === r.id ? null : r.id))}>
                                  <div className="f-display text-base font-semibold" style={{ color: T.green }}>Phòng {r.roomNumber}</div>
                                  <div className="f-mono text-[10.5px]" style={{ color: T.inkSoft }}>{r.area || "—"} · {r.gender || "Nam"}</div>
                                </div>
                                <span className="f-display text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm shrink-0" style={{ background: statusColor[effectiveRoomStatus(r, occ.length)], color: "#fff" }}>
                                  {effectiveRoomStatus(r, occ.length)}
                                </span>
                              </div>
                              <div className="f-body text-xs mt-2" style={{ color: T.ink }}>
                                Sĩ số: <b>{occ.length}</b> / {cap || "—"} chỗ
                              </div>
                              {r.note && <div className="f-body text-[11px] italic mt-1" style={{ color: T.inkSoft }}>{r.note}</div>}
                              {r.status === "Đang bảo trì" && r.maintenanceReason && (
                                <div className="f-body text-[11px] mt-1" style={{ color: T.red }}>
                                  Lý do bảo trì: <b>{r.maintenanceReason}</b>{r.maintenanceNote ? ` — ${r.maintenanceNote}` : ""}
                                </div>
                              )}

                              {r.imageUrl && (
                                <div className="mt-2 relative group">
                                  <img src={r.imageUrl} alt={`Ảnh phòng ${r.roomNumber}`} className="w-full h-32 object-cover stamp-border" />
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); downloadFileFromUrl(r.imageUrl, `phong-${r.roomNumber}.jpg`); }}
                                    title="Tải ảnh về máy"
                                    className="absolute bottom-1.5 right-1.5 flex items-center gap-1 px-2 py-1 rounded-sm f-mono text-[10px] btn-press"
                                    style={{ background: "rgba(31,51,40,0.85)", color: "#fff", border: "none" }}
                                  >
                                    <Upload size={11} style={{ transform: "rotate(180deg)" }} /> Tải về
                                  </button>
                                </div>
                              )}

                              {expandedId === r.id && (
                                <div className="mt-2 pt-2" style={{ borderTop: `1px dashed ${T.paperDark}` }}>
                                  <div className="f-mono text-[9.5px] uppercase tracking-widest mb-1.5" style={{ color: T.amberDark }}>Sơ đồ giường (giường tầng — mỗi vị trí 2 giường trên/dưới)</div>
                                  {cap > 0 ? (
                                    <div className="grid grid-cols-2 gap-1.5 mb-2">
                                      {Array.from({ length: Math.ceil(cap / 2) }, (_, i) => i + 1).map((pos) => {
                                        const lowerNo = pos * 2 - 1;
                                        const upperNo = pos * 2;
                                        const beds = [lowerNo, ...(upperNo <= cap ? [upperNo] : [])];
                                        return (
                                          <div key={pos} className="p-1.5 rounded-sm" style={{ border: `1px solid ${T.paperDark}`, background: "rgba(31,51,40,0.03)" }}>
                                            <div className="f-mono text-[9px] uppercase tracking-wider mb-1" style={{ color: T.inkSoft }}>Vị trí {pos}</div>
                                            <div className="space-y-1">
                                              {beds.map((bedNo) => {
                                                const { role } = bedPosition(bedNo);
                                                const occByBed = occ.find((s) => String(s.bed) === String(bedNo));
                                                return (
                                                  <div
                                                    key={bedNo}
                                                    onClick={() => occByBed && setViewStudentId(occByBed.id)}
                                                    title={occByBed ? `${occByBed.name}${occByBed.msv ? ` — ${occByBed.msv}` : ""}` : "Giường trống"}
                                                    className="f-body text-[10.5px] px-1.5 py-1 rounded-sm"
                                                    style={{
                                                      background: occByBed ? T.selectBg : "#fff",
                                                      border: `1px solid ${occByBed ? T.selectBorder : T.paperDark}`,
                                                      cursor: occByBed ? "pointer" : "default",
                                                    }}
                                                  >
                                                    <div className="flex items-center gap-1" style={{ color: T.inkSoft }}>
                                                      <BedDouble size={10} style={{ color: occByBed ? T.selectBorder : T.inkSoft, flexShrink: 0 }} />
                                                      <span className="f-mono" style={{ fontSize: 9 }}>{role} (G{bedNo})</span>
                                                    </div>
                                                    <div
                                                      className="truncate"
                                                      style={{ color: occByBed ? T.green : T.inkSoft, fontStyle: occByBed ? "normal" : "italic", fontWeight: occByBed ? 600 : 400 }}
                                                    >
                                                      {occByBed ? occByBed.name : "Trống"}
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="f-body text-[11px] italic mb-2" style={{ color: T.inkSoft }}>Chưa khai báo sức chứa để chia giường.</div>
                                  )}
                                  {occ.some((s) => !s.bed) && (
                                    <div className="mb-1">
                                      <div className="flex items-center justify-between gap-2 mb-1">
                                        <div className="f-mono text-[9.5px] uppercase tracking-widest" style={{ color: T.inkSoft }}>Chưa gán số giường</div>
                                        {perm.canManage && (
                                          <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); autoAssignRoomBeds(r); }}
                                            className="f-mono text-[10px] underline shrink-0"
                                            style={{ color: T.amberDark }}
                                          >
                                            Gán giường tự động
                                          </button>
                                        )}
                                      </div>
                                      <ul className="space-y-0.5">
                                        {occ.filter((s) => !s.bed).map((s) => (
                                          <li key={s.id} className="f-body text-[11.5px] flex items-center justify-between" style={{ color: T.ink }}>
                                            <span>{s.name}</span>
                                            <span className="f-mono text-[10px]" style={{ color: T.inkSoft }}>{s.msv}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {occ.length === 0 && cap === 0 && (
                                    <div className="f-body text-[11px] italic" style={{ color: T.inkSoft }}>Chưa có sinh viên nào.</div>
                                  )}

                                  {occ.length > 0 && (
                                    <div className="mt-2 pt-2" style={{ borderTop: `1px dashed ${T.paperDark}` }}>
                                      <div className="f-mono text-[9.5px] uppercase tracking-widest mb-1.5" style={{ color: T.amberDark }}>
                                        Danh sách sinh viên trong phòng ({occ.length})
                                      </div>
                                      <ul className="space-y-1">
                                        {occ.map((s) => (
                                          <li key={s.id} className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={(e) => { e.stopPropagation(); setViewStudentId(s.id); }}
                                              className="flex-1 min-w-0 flex items-center justify-between gap-2 px-2 py-1.5 rounded-sm text-left btn-press"
                                              style={{ background: "rgba(31,51,40,0.04)", border: `1px solid ${T.paperDark}` }}
                                            >
                                              <span className="f-body text-[11.5px] font-medium truncate" style={{ color: T.green }}>{s.name}</span>
                                              <span className="f-mono text-[10px] shrink-0" style={{ color: T.inkSoft }}>{s.lop || s.msv || ""}{s.bed ? ` · G${s.bed}` : ""}</span>
                                            </button>
                                            {perm.canManage && occ.length > 1 && (
                                              <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setSwapStudent(s); }}
                                                title="Đổi giường với bạn cùng phòng"
                                                className="shrink-0 p-1.5 rounded-sm btn-press"
                                                style={{ border: `1px solid ${T.paperDark}` }}
                                              >
                                                <Repeat size={12} style={{ color: T.amberDark }} />
                                              </button>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}

                              {perm.canManage && (
                                <div className="flex items-center flex-wrap gap-2 mt-3">
                                  <button onClick={() => setEditingId(r.id)} title="Sửa"><Pencil size={13} style={{ color: T.green }} /></button>
                                  <button onClick={() => removeRoom(r.id)} title="Xoá"><Trash2 size={13} style={{ color: T.red }} /></button>
                                  {r.status !== "Đang bảo trì" ? (
                                    <button className="f-mono text-[10px] underline" style={{ color: T.red }} onClick={() => requestMaintenance(r)}>Đánh dấu bảo trì</button>
                                  ) : (
                                    <button className="f-mono text-[10px] underline" style={{ color: T.green }} onClick={() => toggleStatus(r, occ.length > 0 ? "Đang ở" : "Trống")}>Bỏ đánh dấu bảo trì</button>
                                  )}
                                  {occ.length > 0 && (
                                    <button className="f-mono text-[10px] underline" style={{ color: T.amberDark }} onClick={() => { setMergeFrom(r); setMergeTarget(""); }}>Dồn phòng…</button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            </div>
            );
          })}
        </div>
      )}

      {mergeFrom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(19,31,25,0.55)" }} onClick={() => { setMergeFrom(null); setMergeReason(""); }}>
          <div className="stamp-border p-5 w-full max-w-md" style={{ background: "#fff" }} onClick={(e) => e.stopPropagation()}>
            <div className="f-display text-sm uppercase tracking-wider mb-3" style={{ color: T.amberDark }}>
              Dồn phòng {roomLabel(mergeFrom)}
            </div>
            <p className="f-body text-xs mb-3" style={{ color: T.inkSoft }}>
              Toàn bộ {occupantsOf(mergeFrom.id).length} sinh viên đang ở phòng này sẽ được chuyển sang phòng đích bên dưới; phòng gốc sẽ chuyển về trạng thái Trống.
            </p>
            <Field label="Phòng đích" required>
              <select className={inputCls} style={inputStyle} value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)}>
                <option value="">— Chọn phòng đích —</option>
                {rooms.filter((r) => r.id !== mergeFrom.id).map((r) => (
                  <option key={r.id} value={r.id}>{roomLabel(r)} ({occupantsOf(r.id).length}/{r.capacity || "—"})</option>
                ))}
              </select>
            </Field>
            <Field label="Lý do chuyển phòng" required>
              <select className={inputCls} style={inputStyle} value={mergeReason} onChange={(e) => setMergeReason(e.target.value)}>
                <option value="">— Chọn lý do —</option>
                {TRANSFER_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <div className="flex gap-2 mt-2">
              <Btn onClick={doMerge} disabled={!mergeTarget || !mergeReason}>Xác nhận dồn phòng</Btn>
              <Btn variant="outline" onClick={() => { setMergeFrom(null); setMergeReason(""); }}>Huỷ</Btn>
            </div>
          </div>
        </div>
      )}

      {maintTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(19,31,25,0.55)" }} onClick={() => setMaintTarget(null)}>
          <div className="stamp-border p-5 w-full max-w-md" style={{ background: "#fff" }} onClick={(e) => e.stopPropagation()}>
            <div className="f-display text-sm uppercase tracking-wider mb-3" style={{ color: T.red }}>
              Phòng đang có sinh viên ở
            </div>
            <p className="f-body text-xs mb-3" style={{ color: T.inkSoft }}>
              {roomLabel(maintTarget)} hiện có <b>{occupantsOf(maintTarget.id).length}</b> sinh viên. Nếu phòng cần sửa gấp và phải chuyển sinh viên đi nơi khác,
              hãy đóng hộp này và dùng <b>"Dồn phòng…"</b> để chuyển sinh viên trước. Nếu sinh viên vẫn giữ chỗ (VD: đang nghỉ lễ/Tết/hè, đi thực tập) và bạn chỉ
              cần đánh dấu để theo dõi bảo trì, hãy chọn lý do bên dưới rồi xác nhận.
            </p>
            <Field label="Lý do đánh dấu bảo trì" required>
              <select className={inputCls} style={inputStyle} value={maintReason} onChange={(e) => setMaintReason(e.target.value)}>
                <option value="">— Chọn lý do —</option>
                {MAINTENANCE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Ghi chú thêm (không bắt buộc)">
              <input className={inputCls} style={inputStyle} value={maintNote} onChange={(e) => setMaintNote(e.target.value)} placeholder="VD: dự kiến sửa xong 25/7…" />
            </Field>
            <div className="flex gap-2 mt-2 flex-wrap">
              <Btn onClick={confirmMaintenance} disabled={!maintReason}>Xác nhận đánh dấu bảo trì</Btn>
              <Btn variant="outline" onClick={() => { const r = maintTarget; setMaintTarget(null); setMergeFrom(r); setMergeTarget(""); }}>Dồn phòng cho SV trước</Btn>
              <Btn variant="outline" onClick={() => setMaintTarget(null)}>Huỷ</Btn>
            </div>
          </div>
        </div>
      )}

      {viewStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(19,31,25,0.55)" }} onClick={() => setViewStudentId(null)}>
          <div className="stamp-border p-5 w-full max-w-md" style={{ background: "#fff" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="f-display text-base font-semibold" style={{ color: T.green }}>{viewStudent.name}</div>
              <button onClick={() => setViewStudentId(null)} title="Đóng"><X size={16} style={{ color: T.inkSoft }} /></button>
            </div>
            <div className="space-y-1.5 f-body text-sm">
              {[
                ["Mã số SV", viewStudent.msv],
                ["Giới tính", viewStudent.gender],
                ["Khoá", viewStudent.khoa],
                ["Lớp", viewStudent.lop],
                ["Đại đội", viewStudent.daiDoi],
                ["Đơn vị tuyển sinh", viewStudent.donViTuyenSinh],
                ["Năm học", viewStudent.namHoc],
                ["Ngày sinh", formatDob(viewStudent.dob)],
                ["Số điện thoại", viewStudent.phone],
                ["Phòng đang ở", viewStudentRoom ? `${roomLabel(viewStudentRoom)}${viewStudent.bed ? ` · Giường ${viewStudent.bed}` : ""}` : "—"],
                ["Trạng thái", viewStudent.status],
                ["Ghi chú", viewStudent.note],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-3 py-1" style={{ borderBottom: `1px dashed ${T.paperDark}` }}>
                  <span className="f-mono text-[10.5px] uppercase tracking-widest shrink-0" style={{ color: T.inkSoft }}>{label}</span>
                  <span className="text-right" style={{ color: T.ink }}>{value || "—"}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <Btn variant="outline" onClick={() => setViewStudentId(null)}>Đóng</Btn>
            </div>
          </div>
        </div>
      )}

      {swapStudent && (
        <SwapBedModal student={swapStudent} students={students} rooms={rooms} onClose={() => setSwapStudent(null)} onConfirm={confirmSwap} />
      )}
    </div>
  );
}

/* ============================================================
   TAB: SINH VIÊN NỘI TRÚ & PHÒNG – GIƯỜNG
   ============================================================ */
function TransferModal({ student, rooms, students, onClose, onConfirm }) {
  const [roomId, setRoomId] = useState(student.roomId || "");
  const [bed, setBed] = useState(student.bed || "");
  const [err, setErr] = useState("");

  const occupantsOf = (rid) => students.filter((s) => s.roomId === rid && s.status !== "Đã trả phòng" && s.id !== student.id);
  const chosenRoom = rooms.find((r) => r.id === Number(roomId));

  // Khi chọn phòng, tự động gán luôn giường trống nhỏ nhất còn lại — không để trống chờ gán tay như trước.
  // Vẫn cho sửa tay số giường (VD học viên muốn đổi giường cho nhau) nên input không bị khoá cứng.
  const handleRoomChange = (val) => {
    setRoomId(val);
    setErr("");
    const room = rooms.find((r) => r.id === Number(val));
    if (room) {
      const usedBeds = new Set(occupantsOf(room.id).map((s) => String(s.bed)).filter(Boolean));
      setBed(pickFreeBed(room.capacity, usedBeds));
    } else {
      setBed("");
    }
  };

  const confirm = () => {
    if (!roomId) { setErr("Vui lòng chọn phòng."); return; }
    const room = rooms.find((r) => r.id === Number(roomId));
    if (!room) return;
    const occ = occupantsOf(room.id);
    if (room.capacity && occ.length >= Number(room.capacity)) { setErr("Phòng đã đủ số chỗ, chọn phòng khác."); return; }
    if (room.gender && student.gender && room.gender !== student.gender) { setErr(`Phòng này chỉ dành cho giới tính "${room.gender}", không khớp với sinh viên (${student.gender}).`); return; }
    if (bed && occ.some((o) => String(o.bed) === String(bed))) { setErr(`Giường ${bed} đã có người ở, vui lòng chọn số giường khác (hoặc dùng "Đổi giường" để hoán đổi trực tiếp).`); return; }
    onConfirm(room.id, bed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(19,31,25,0.55)" }} onClick={onClose}>
      <div className="stamp-border p-5 w-full max-w-md" style={{ background: "#fff" }} onClick={(e) => e.stopPropagation()}>
        <div className="f-display text-sm uppercase tracking-wider mb-3" style={{ color: T.amberDark }}>
          Chuyển phòng — {student.name}
        </div>
        <FormWarning message={err} />
        <Field label="Phòng mới" required>
          <select className={inputCls} style={inputStyle} value={roomId} onChange={(e) => handleRoomChange(e.target.value)}>
            <option value="">— Chọn phòng —</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>{roomLabel(r)} · {r.gender || "Nam"} ({occupantsOf(r.id).length}/{r.capacity || "—"})</option>
            ))}
          </select>
        </Field>
        <Field label="Số giường (đã tự gán, có thể sửa tay nếu cần)">
          <input className={inputCls} style={inputStyle} value={bed} onChange={(e) => setBed(e.target.value)} placeholder="VD: 2" />
        </Field>
        {chosenRoom?.status === "Đang bảo trì" && (
          <div className="f-body text-xs mb-2" style={{ color: T.red }}>⚠ Phòng này đang được đánh dấu bảo trì.</div>
        )}
        <div className="flex gap-2 mt-2">
          <Btn onClick={confirm}>Xác nhận chuyển phòng</Btn>
          <Btn variant="outline" onClick={onClose}>Huỷ</Btn>
        </div>
      </div>
    </div>
  );
}

// Đổi giường cho nhau giữa 2 sinh viên đang ở cùng 1 phòng — dùng khi học viên báo muốn hoán đổi chỗ nằm.
// Đổi giường cho học viên: cho chọn bất kỳ giường nào trong phòng — nếu giường đó đang có người thì tự
// hoán đổi qua lại, còn nếu đang trống thì chuyển thẳng sang (không cần phải có người để "đổi với").
function SwapBedModal({ student, students, rooms, onClose, onConfirm }) {
  const room = rooms.find((r) => r.id === student.roomId);
  const cap = Number(room?.capacity) || 0;
  const occupants = students.filter((s) => s.roomId === student.roomId && s.status !== "Đã trả phòng" && s.id !== student.id);
  const occByBed = {};
  occupants.forEach((s) => { if (s.bed) occByBed[String(s.bed)] = s; });

  const bedOptions = cap > 0
    ? Array.from({ length: cap }, (_, i) => String(i + 1)).filter((n) => n !== String(student.bed || ""))
    : [...new Set(occupants.map((s) => String(s.bed)).filter(Boolean))];

  const [targetBed, setTargetBed] = useState("");
  const targetOccupant = targetBed ? occByBed[targetBed] || null : null;

  const confirm = () => {
    if (!targetBed) return;
    onConfirm(student, { bed: targetBed, swapWithId: targetOccupant ? targetOccupant.id : null });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(19,31,25,0.55)" }} onClick={onClose}>
      <div className="stamp-border p-5 w-full max-w-md" style={{ background: "#fff" }} onClick={(e) => e.stopPropagation()}>
        <div className="f-display text-sm uppercase tracking-wider mb-3" style={{ color: T.amberDark }}>
          Đổi giường — {student.name}
        </div>
        <div className="f-body text-xs mb-3" style={{ color: T.inkSoft }}>
          Đang ở {room ? roomLabel(room) : "—"}{student.bed ? ` · Giường ${student.bed}` : " · chưa gán giường"}. Chọn giường muốn chuyển đến: nếu giường đó đang có bạn khác ở, hệ thống tự hoán đổi qua lại; nếu đang trống thì chuyển thẳng sang.
        </div>
        {bedOptions.length === 0 ? (
          <div className="f-body text-xs italic" style={{ color: T.inkSoft }}>Phòng này chưa khai báo sức chứa hoặc không còn giường nào khác để chọn.</div>
        ) : (
          <Field label="Chuyển đến giường" required>
            <select className={inputCls} style={inputStyle} value={targetBed} onChange={(e) => setTargetBed(e.target.value)}>
              <option value="">— Chọn giường —</option>
              {bedOptions
                .sort((a, b) => Number(a) - Number(b))
                .map((n) => {
                  const occ = occByBed[n];
                  const { role } = bedPosition(Number(n));
                  return (
                    <option key={n} value={n}>
                      Giường {n} ({role}) — {occ ? `${occ.name} (sẽ đổi qua lại)` : "Trống"}
                    </option>
                  );
                })}
            </select>
          </Field>
        )}
        <div className="flex gap-2 mt-2">
          <Btn onClick={confirm} disabled={!targetBed}>Xác nhận đổi giường</Btn>
          <Btn variant="outline" onClick={onClose}>Huỷ</Btn>
        </div>
      </div>
    </div>
  );
}

const STUDENT_BLANK = { msv: "", name: "", gender: "Nam", khoa: "", lop: "", daiDoi: "", donViTuyenSinh: "", namHoc: "Năm 1", phone: "", dob: "", note: "" };

function StudentsTab({ perm, user }) {
  const { items: students, setItems: setStudents, loading } = useSharedList("students");
  const { items: rooms } = useSharedList("rooms");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(STUDENT_BLANK);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [warn, setWarn] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const [filterBuilding, setFilterBuilding] = useState("");
  const [filterArea, setFilterArea] = useState("");
  const [filterRoom, setFilterRoom] = useState("");
  const [filterLop, setFilterLop] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [transferTarget, setTransferTarget] = useState(null);
  const [swapTarget, setSwapTarget] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const add = async () => {
    if (!form.msv.trim() || !form.name.trim() || !form.gender.trim()) { setWarn("Vui lòng nhập đủ Mã số SV, Họ tên và Giới tính trước khi lưu."); return; }
    if (students.some((s) => normalizeName(s.msv) === normalizeName(form.msv))) { setWarn(`Mã số SV "${form.msv}" đã tồn tại.`); return; }
    setWarn("");
    await setStudents([...students, { id: Date.now(), ...form, roomId: "", bed: "", status: "Chưa xếp phòng" }]);
    setForm(STUDENT_BLANK);
    setShowForm(false);
  };
  const remove = async (id) => setStudents(students.filter((s) => s.id !== id));

  const startEdit = (s) => { setEditingId(s.id); setEditForm({ ...s }); };
  const cancelEdit = () => { setEditingId(null); setEditForm(null); };
  const saveEdit = async () => {
    if (!editForm.name.trim()) { setWarn("Vui lòng nhập Họ và tên."); return; }
    await setStudents(students.map((s) => (s.id === editingId ? { ...editForm } : s)));
    cancelEdit();
  };

  const checkout = async (s) => {
    await setStudents(students.map((x) => (x.id === s.id ? { ...x, roomId: "", bed: "", status: "Đã trả phòng" } : x)));
  };
  const confirmTransfer = async (roomId, bed) => {
    await setStudents(students.map((s) => (s.id === transferTarget.id ? { ...s, roomId, bed, status: "Đang ở" } : s)));
    setTransferTarget(null);
  };
  // Chuyển học viên sang giường được chọn; nếu giường đó đang có người thì tự hoán đổi qua lại,
  // nếu đang trống thì chuyển thẳng — dùng khi học viên báo muốn đổi chỗ nằm.
  const confirmSwap = async (student, action) => {
    await setStudents(students.map((s) => {
      if (s.id === student.id) return { ...s, bed: action.bed };
      if (action.swapWithId && s.id === action.swapWithId) return { ...s, bed: student.bed };
      return s;
    }));
    setWarn("");
    setSwapTarget(null);
  };

  const q = search.trim().toLowerCase();
  // Danh mục để lọc nhanh — lấy từ dữ liệu phòng/sinh viên hiện có, luôn cập nhật theo dữ liệu thực tế.
  const buildingOptions = [...new Set(rooms.map((r) => r.building).filter(Boolean))].sort(naturalCompare);
  const areaOptions = [...new Set(rooms.filter((r) => !filterBuilding || r.building === filterBuilding).map((r) => r.area).filter(Boolean))].sort(naturalCompare);
  const roomOptions = rooms
    .filter((r) => !filterBuilding || r.building === filterBuilding)
    .filter((r) => !filterArea || r.area === filterArea)
    .sort((a, b) => naturalCompare(a.building || "", b.building || "") || naturalCompare(a.area || "", b.area || "") || naturalCompare(String(a.roomNumber || ""), String(b.roomNumber || "")));
  const lopOptions = [...new Set(students.map((s) => s.lop).filter(Boolean))].sort(naturalCompare);
  const yearOptions = [...new Set(students.map((s) => (s.dob ? String(s.dob).split("-")[0] : "")).filter(Boolean))].sort((a, b) => b.localeCompare(a));

  const filtered = students.filter((s) => {
    const room = rooms.find((r) => r.id === s.roomId);
    if (filterBuilding && room?.building !== filterBuilding) return false;
    if (filterArea && room?.area !== filterArea) return false;
    if (filterRoom && String(s.roomId) !== filterRoom) return false;
    if (filterLop && s.lop !== filterLop) return false;
    if (filterYear && (!s.dob || String(s.dob).split("-")[0] !== filterYear)) return false;
    if (filterStatus && (s.status || "Chưa xếp phòng") !== filterStatus) return false;
    if (!q) return true;
    const haystack = [
      s.msv, s.name, s.gender, s.khoa, s.lop, s.daiDoi, s.donViTuyenSinh, s.namHoc, s.phone, formatDob(s.dob),
      room ? roomLabel(room) : "", room?.building, room?.area, s.bed ? `giường ${s.bed}` : "",
    ].join(" ").toLowerCase();
    return haystack.includes(q);
  });

  const STATUS_ALL = ["Chưa xếp phòng", "Đang ở", "Đã trả phòng"];

  return (
    <div>
      <SectionHeader compact icon={Users} eyebrow={`Tổng số sinh viên: ${students.length}`} title="Sinh viên nội trú"
        action={perm.canManage && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Btn size="sm" variant="outline" onClick={() => setShowImport((s) => !s)}><Upload size={14} /> Nhập từ ảnh/tệp</Btn>
            <Btn size="sm" onClick={() => (showForm ? setShowForm(false) : setShowForm(true))}><Plus size={14} /> Thêm sinh viên</Btn>
          </div>
        )} />

      {perm.canManage && showImport && (
        <StudentImportPanel
          existingItems={students}
          onClose={() => setShowImport(false)}
          onConfirm={async (rows) => {
            const filtered2 = rows.filter((r) => !students.some((s) => normalizeName(s.msv) === normalizeName(r.msv) && r.msv));
            await setStudents([...students, ...filtered2]);
            setShowImport(false);
          }}
        />
      )}

      {perm.canManage && showForm && (
        <div className="stamp-border p-4 mb-5 grid grid-cols-1 md:grid-cols-3 gap-3" style={{ background: "#fff" }}>
          <div className="md:col-span-3"><FormWarning message={warn} /></div>
          <Field label="Mã số SV" required><input className={inputCls} style={inputStyle} value={form.msv} onChange={(e) => setForm({ ...form, msv: e.target.value })} /></Field>
          <Field label="Họ và tên" required><input className={inputCls} style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Giới tính">
            <select className={inputCls} style={inputStyle} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="Khoá học"><input className={inputCls} style={inputStyle} value={form.khoa} onChange={(e) => setForm({ ...form, khoa: e.target.value })} placeholder="VD: K10" /></Field>
          <Field label="Lớp"><input className={inputCls} style={inputStyle} value={form.lop} onChange={(e) => setForm({ ...form, lop: e.target.value })} /></Field>
          <Field label="Đại đội (nếu áp dụng)"><input className={inputCls} style={inputStyle} value={form.daiDoi} onChange={(e) => setForm({ ...form, daiDoi: e.target.value })} placeholder="VD: Đại đội 3" /></Field>
          <Field label="Đơn vị tuyển sinh"><input className={inputCls} style={inputStyle} value={form.donViTuyenSinh} onChange={(e) => setForm({ ...form, donViTuyenSinh: e.target.value })} placeholder="VD: Bộ CHQS tỉnh..." /></Field>
          <Field label="Năm học">
            <select className={inputCls} style={inputStyle} value={form.namHoc} onChange={(e) => setForm({ ...form, namHoc: e.target.value })}>
              {NAM_HOC_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="Ngày sinh"><input type="date" className={inputCls} style={inputStyle} value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></Field>
          <Field label="SĐT"><input className={inputCls} style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Ghi chú"><input className={inputCls} style={inputStyle} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          <div className="md:col-span-3"><Btn onClick={add}>Lưu — sinh viên sẽ ở trạng thái "Chưa xếp phòng"</Btn></div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: T.inkSoft }} />
          <input className={inputCls} style={{ ...inputStyle, paddingLeft: 30 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên, MSV, phòng, giường…" />
        </div>
        <select className={inputCls} style={{ ...inputStyle, width: "auto" }} value={filterBuilding} onChange={(e) => { setFilterBuilding(e.target.value); setFilterArea(""); setFilterRoom(""); }}>
          <option value="">— Tất cả toà nhà —</option>
          {buildingOptions.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className={inputCls} style={{ ...inputStyle, width: "auto" }} value={filterArea} onChange={(e) => { setFilterArea(e.target.value); setFilterRoom(""); }}>
          <option value="">— Tất cả tầng/khu vực —</option>
          {areaOptions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className={inputCls} style={{ ...inputStyle, width: "auto" }} value={filterRoom} onChange={(e) => setFilterRoom(e.target.value)}>
          <option value="">— Tất cả phòng —</option>
          {roomOptions.map((r) => <option key={r.id} value={r.id}>{roomLabel(r)}</option>)}
        </select>
        <select className={inputCls} style={{ ...inputStyle, width: "auto" }} value={filterLop} onChange={(e) => setFilterLop(e.target.value)}>
          <option value="">— Tất cả lớp —</option>
          {lopOptions.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select className={inputCls} style={{ ...inputStyle, width: "auto" }} value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
          <option value="">— Tất cả năm sinh —</option>
          {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className={inputCls} style={{ ...inputStyle, width: "auto" }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">— Tất cả trạng thái —</option>
          {STATUS_ALL.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? <LoadingRow /> : filtered.length === 0 ? <EmptyState text="Không có sinh viên nào phù hợp." /> : (
        <div className="overflow-x-auto overflow-y-auto stamp-border card-sheet" style={{ background: "#fff", maxHeight: 460 }}>
          <table className="w-full f-body table-lines" style={{ fontSize: "12.5px" }}>
            <thead>
              <tr className="f-mono text-[9.5px] uppercase tracking-widest" style={{ background: T.green, color: T.paper, position: "sticky", top: 0, zIndex: 1 }}>
                <th className="text-left px-2.5 py-2">Mã SV</th>
                <th className="text-left px-2.5 py-2 min-w-[110px]">Họ tên</th>
                <th className="text-left px-2.5 py-2">Giới tính</th>
                <th className="text-left px-2.5 py-2">Khoá/Lớp</th>
                <th className="text-left px-2.5 py-2">Năm học</th>
                <th className="text-left px-2.5 py-2">Phòng - Giường</th>
                <th className="text-left px-2.5 py-2">Trạng thái</th>
                <th className="px-2.5 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const room = rooms.find((r) => r.id === s.roomId);
                const isEditing = editingId === s.id;
                if (isEditing) {
                  return (
                    <tr key={s.id}><td colSpan={8} className="p-2">
                      <div className="stamp-border p-3 grid grid-cols-1 md:grid-cols-3 gap-2" style={{ background: T.paper }}>
                        <Field label="Mã số SV"><input className={inputCls} style={inputStyle} value={editForm.msv} onChange={(e) => setEditForm({ ...editForm, msv: e.target.value })} /></Field>
                        <Field label="Họ và tên"><input className={inputCls} style={inputStyle} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></Field>
                        <Field label="Giới tính">
                          <select className={inputCls} style={inputStyle} value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
                            {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </Field>
                        <Field label="Khoá học"><input className={inputCls} style={inputStyle} value={editForm.khoa} onChange={(e) => setEditForm({ ...editForm, khoa: e.target.value })} /></Field>
                        <Field label="Lớp"><input className={inputCls} style={inputStyle} value={editForm.lop} onChange={(e) => setEditForm({ ...editForm, lop: e.target.value })} /></Field>
                        <Field label="Đại đội"><input className={inputCls} style={inputStyle} value={editForm.daiDoi || ""} onChange={(e) => setEditForm({ ...editForm, daiDoi: e.target.value })} /></Field>
                        <Field label="Đơn vị tuyển sinh"><input className={inputCls} style={inputStyle} value={editForm.donViTuyenSinh || ""} onChange={(e) => setEditForm({ ...editForm, donViTuyenSinh: e.target.value })} /></Field>
                        <Field label="Năm học">
                          <select className={inputCls} style={inputStyle} value={editForm.namHoc} onChange={(e) => setEditForm({ ...editForm, namHoc: e.target.value })}>
                            {NAM_HOC_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </Field>
                        <Field label="Ngày sinh"><input type="date" className={inputCls} style={inputStyle} value={editForm.dob} onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })} /></Field>
                        <Field label="SĐT"><input className={inputCls} style={inputStyle} value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></Field>
                        <Field label="Ghi chú"><input className={inputCls} style={inputStyle} value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} /></Field>
                        <div className="md:col-span-3 flex gap-2"><Btn onClick={saveEdit}>Lưu</Btn><Btn variant="outline" onClick={cancelEdit}>Huỷ</Btn></div>
                      </div>
                    </td></tr>
                  );
                }
                return (
                  <tr key={s.id} onClick={() => setSelectedId((id) => (id === s.id ? null : s.id))} className="cursor-pointer" style={withSelect({ background: i % 2 ? T.paper : "#fff", borderBottom: `1px solid ${T.paperDark}` }, selectedId === s.id)}>
                    <td className="px-2.5 py-2 f-mono" style={{ borderRight: `1px solid ${T.paperDark}` }}>{s.msv || "—"}</td>
                    <td className="px-2.5 py-2 font-bold text-[11px]" style={{ borderRight: `1px solid ${T.paperDark}` }}>{s.name}</td>
                    <td className="px-2.5 py-2" style={{ borderRight: `1px solid ${T.paperDark}` }}>{s.gender || "—"}</td>
                    <td className="px-2.5 py-2 f-mono" style={{ borderRight: `1px solid ${T.paperDark}` }}>{s.khoa || "—"} / {s.lop || "—"}</td>
                    <td className="px-2.5 py-2" style={{ borderRight: `1px solid ${T.paperDark}` }}>{s.namHoc || "—"}</td>
                    <td className="px-2.5 py-2 f-mono" style={{ borderRight: `1px solid ${T.paperDark}` }}>{room ? roomLabel(room) : "—"}{s.bed ? ` · G${s.bed}` : ""}</td>
                    <td className="px-2.5 py-2" style={{ borderRight: `1px solid ${T.paperDark}` }}>
                      <span className="f-mono text-[10px] uppercase px-1.5 py-0.5 rounded-sm" style={{
                        background: s.status === "Đang ở" ? T.green : s.status === "Đã trả phòng" ? T.red : T.amberDark, color: "#fff",
                      }}>{s.status || "Chưa xếp phòng"}</span>
                    </td>
                    <td className="px-2.5 py-2">
                      {perm.canManage && (
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <button onClick={(e) => { e.stopPropagation(); setTransferTarget(s); }} title="Chuyển phòng"><ArrowRightLeft size={13} style={{ color: T.amberDark }} /></button>
                          {s.roomId && (
                            <button onClick={(e) => { e.stopPropagation(); setSwapTarget(s); }} title="Đổi giường với bạn cùng phòng"><Repeat size={13} style={{ color: T.green }} /></button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); startEdit(s); }} title="Sửa"><Pencil size={13} style={{ color: T.green }} /></button>
                          {s.roomId && (
                            <button onClick={(e) => { e.stopPropagation(); checkout(s); }} title="Trả phòng"><DoorOpen size={13} style={{ color: T.red }} /></button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); remove(s.id); }} title="Xoá"><Trash2 size={13} style={{ color: T.red }} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {transferTarget && (
        <TransferModal student={transferTarget} rooms={rooms} students={students} onClose={() => setTransferTarget(null)} onConfirm={confirmTransfer} />
      )}
      {swapTarget && (
        <SwapBedModal student={swapTarget} students={students} rooms={rooms} onClose={() => setSwapTarget(null)} onConfirm={confirmSwap} />
      )}
    </div>
  );
}

/* ============================================================
   TAB: BỐ TRÍ SINH VIÊN TỰ ĐỘNG (giới tính, khoá học, năm học)
   ============================================================ */
function AssignmentTab({ perm }) {
  const { items: students, setItems: setStudents, loading: studentsLoading } = useSharedList("students");
  const { items: rooms, loading: roomsLoading } = useSharedList("rooms");
  const [gender, setGender] = useState("");
  const [khoa, setKhoa] = useState("");
  const [namHoc, setNamHoc] = useState("");
  const [preview, setPreview] = useState(null);
  const [msg, setMsg] = useState("");

  const unassigned = students.filter((s) => !s.roomId && s.status !== "Đã trả phòng").filter((s) =>
    (!gender || s.gender === gender) && (!khoa || s.khoa === khoa) && (!namHoc || s.namHoc === namHoc)
  );

  const khoaOptions = [...new Set(students.map((s) => s.khoa).filter(Boolean))];

  // Số người đang ở hiện tại của từng phòng (từ dữ liệu đã lưu, chưa tính đợt bố trí đang chạy thử).
  const computeRemaining = () => {
    const occ = {};
    students.forEach((s) => { if (s.roomId && s.status !== "Đã trả phòng") occ[s.roomId] = (occ[s.roomId] || 0) + 1; });
    const rem = {};
    rooms.forEach((r) => { rem[r.id] = Math.max((Number(r.capacity) || 0) - (occ[r.id] || 0), 0); });
    return rem;
  };
  const roomOccupants = (roomId) => students.filter((s) => s.roomId === roomId && s.status !== "Đã trả phòng");

  // Gợi ý thông minh cho 1 học viên: tự xét giới tính (bắt buộc đúng), còn chỗ trống, ưu tiên phòng đã có
  // bạn cùng lớp / cùng khoá ở (để giữ đơn vị đi cùng nhau), và không được đang bảo trì.
  const suggestRoomsForStudent = (student, remainingMap) => {
    if (!student) return [];
    const g = student.gender || "Nam";
    return rooms
      .filter((r) => (r.status || "Trống") !== "Đang bảo trì")
      .filter((r) => !r.gender || r.gender === g)
      .filter((r) => (remainingMap[r.id] || 0) > 0)
      .map((r) => {
        const occ = roomOccupants(r.id);
        const sameLop = student.lop ? occ.filter((o) => o.lop && o.lop === student.lop).length : 0;
        const sameKhoa = student.khoa ? occ.filter((o) => o.khoa && o.khoa === student.khoa && o.lop !== student.lop).length : 0;
        const otherLop = occ.filter((o) => student.lop && o.lop && o.lop !== student.lop).length;
        const reasons = [];
        if (sameLop > 0) reasons.push(`Cùng lớp: ${sameLop} bạn đang ở`);
        if (sameKhoa > 0) reasons.push(`Cùng khoá: ${sameKhoa} bạn đang ở`);
        if (occ.length === 0) reasons.push("Phòng đang trống hoàn toàn");
        else if (otherLop > 0 && sameLop === 0) reasons.push(`Có ${otherLop} bạn khác lớp đang ở`);
        reasons.push(`Còn ${remainingMap[r.id]} chỗ trống`);
        const usedBeds = new Set(occ.map((o) => String(o.bed)).filter(Boolean));
        const suggestedBed = pickFreeBed(r.capacity, usedBeds);
        if (suggestedBed) reasons.push(`Sẽ xếp giường: ${suggestedBed}`);
        const score = sameLop * 100 + sameKhoa * 10 - otherLop * 3 + (occ.length === 0 ? 1 : 0);
        return { room: r, score, reasons, sameLop, sameKhoa };
      })
      .sort((a, b) =>
        b.score - a.score ||
        naturalCompare(a.room.building || "", b.room.building || "") ||
        naturalCompare(String(a.room.roomNumber || ""), String(b.room.roomNumber || ""))
      );
  };

  // Gợi ý & xếp cho từng học viên riêng lẻ, chọn tay từng bạn rồi xem gợi ý.
  const [suggestStudentId, setSuggestStudentId] = useState("");
  const suggestStudent = unassigned.find((s) => String(s.id) === String(suggestStudentId)) || null;
  const suggestions = suggestStudent ? suggestRoomsForStudent(suggestStudent, computeRemaining()).slice(0, 5) : [];
  const assignOne = async (studentId, roomId) => {
    const student = students.find((s) => s.id === studentId);
    const room = rooms.find((r) => r.id === roomId);
    const usedBeds = new Set(roomOccupants(roomId).map((s) => String(s.bed)).filter(Boolean));
    const bed = pickFreeBed(room?.capacity, usedBeds);
    await setStudents(students.map((s) => (s.id === studentId ? { ...s, roomId, bed, status: "Đang ở" } : s)));
    setMsg(`Đã xếp ${student?.name || "học viên"} vào ${room ? roomLabel(room) : "phòng"}${bed ? ` — Giường ${bed}` : ""} theo gợi ý.`);
    setSuggestStudentId("");
  };

  const runAssignment = () => {
    const candidateRooms = rooms.filter((r) => (r.status || "Trống") !== "Đang bảo trì");

    const remaining = computeRemaining();
    // Đếm số người theo lớp / theo khoá trong từng phòng — cập nhật dần trong lúc mô phỏng để các bạn
    // cùng lớp/khoá được ưu tiên xếp gần nhau, giữ nguyên đơn vị (trung đội/lớp) trong cùng 1 phòng.
    const roomLopCount = {};
    const roomKhoaCount = {};
    const roomOccCount = {};
    const roomUsedBeds = {}; // roomId -> Set các số giường đã có người, để tự chọn giường trống tiếp theo
    rooms.forEach((r) => { roomOccCount[r.id] = 0; roomUsedBeds[r.id] = new Set(); });
    students.forEach((s) => {
      if (!s.roomId || s.status === "Đã trả phòng") return;
      roomOccCount[s.roomId] = (roomOccCount[s.roomId] || 0) + 1;
      if (s.lop) { const k = `${s.roomId}|${s.lop}`; roomLopCount[k] = (roomLopCount[k] || 0) + 1; }
      if (s.khoa) { const k = `${s.roomId}|${s.khoa}`; roomKhoaCount[k] = (roomKhoaCount[k] || 0) + 1; }
      if (s.bed && roomUsedBeds[s.roomId]) roomUsedBeds[s.roomId].add(String(s.bed));
    });

    // Xếp thứ tự xử lý: theo giới tính (bắt buộc đúng), rồi theo khoá, rồi theo lớp — để các bạn cùng
    // lớp được xét liên tiếp, dễ được gom vào cùng 1 phòng bởi thuật toán chấm điểm bên dưới.
    const sortedStudents = [...unassigned].sort((a, b) =>
      (a.gender || "").localeCompare(b.gender || "") ||
      (a.khoa || "").localeCompare(b.khoa || "") ||
      (a.lop || "").localeCompare(b.lop || "")
    );

    const assignments = [];
    const notPlaced = [];

    sortedStudents.forEach((s) => {
      const g = s.gender || "Nam";
      const options = candidateRooms.filter((r) => (!r.gender || r.gender === g) && (remaining[r.id] || 0) > 0);
      if (options.length === 0) { notPlaced.push(s); return; }
      let best = null;
      let bestScore = -Infinity;
      options.forEach((r) => {
        const sameLop = s.lop ? (roomLopCount[`${r.id}|${s.lop}`] || 0) : 0;
        const sameKhoa = s.khoa ? (roomKhoaCount[`${r.id}|${s.khoa}`] || 0) : 0;
        const occCount = roomOccCount[r.id] || 0;
        const otherLop = Math.max(occCount - sameLop, 0);
        const score = sameLop * 100 + sameKhoa * 10 - otherLop * 3 + (occCount === 0 ? 1 : 0);
        if (score > bestScore) { bestScore = score; best = r; }
      });
      const bed = pickFreeBed(best.capacity, roomUsedBeds[best.id] || new Set());
      assignments.push({ studentId: s.id, studentName: s.name, roomId: best.id, roomLabel: roomLabel(best), bed });
      remaining[best.id] -= 1;
      roomOccCount[best.id] = (roomOccCount[best.id] || 0) + 1;
      if (bed) (roomUsedBeds[best.id] || (roomUsedBeds[best.id] = new Set())).add(bed);
      if (s.lop) { const k = `${best.id}|${s.lop}`; roomLopCount[k] = (roomLopCount[k] || 0) + 1; }
      if (s.khoa) { const k = `${best.id}|${s.khoa}`; roomKhoaCount[k] = (roomKhoaCount[k] || 0) + 1; }
    });

    setPreview({ assignments, notPlaced });
    setMsg("");
  };

  const confirmAssignment = async () => {
    if (!preview || preview.assignments.length === 0) return;
    const map = new Map(preview.assignments.map((a) => [a.studentId, { roomId: a.roomId, bed: a.bed || "" }]));
    await setStudents(students.map((s) => (map.has(s.id) ? { ...s, roomId: map.get(s.id).roomId, bed: map.get(s.id).bed, status: "Đang ở" } : s)));
    setMsg(`Đã bố trí ${preview.assignments.length} sinh viên vào phòng, tự động xếp luôn số giường.`);
    setPreview(null);
  };

  const loading = studentsLoading || roomsLoading;

  return (
    <div>
      <SectionHeader icon={LayoutGrid} eyebrow="Xếp phòng tự động" title="Bố trí sinh viên vào phòng" />
      <p className="f-body text-xs mb-4" style={{ color: T.inkSoft }}>
        Hệ thống chỉ bố trí những sinh viên <b>chưa có phòng</b>, luôn xếp đúng giới tính quy định của từng phòng,
        và tự động ưu tiên gom các bạn <b>cùng lớp / cùng khoá</b> vào chung phòng với nhau (giữ nguyên đơn vị, đỡ phải xếp lại).
        Bạn có thể lọc trước theo Khoá học / Năm học nếu muốn xếp riêng từng đợt, hoặc dùng mục "Gợi ý cho từng học viên" bên dưới để xếp tay theo gợi ý của hệ thống.
      </p>

      <div className="stamp-border p-4 mb-5 grid grid-cols-1 md:grid-cols-4 gap-3" style={{ background: "#fff" }}>
        <Field label="Giới tính">
          <select className={inputCls} style={inputStyle} value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">— Tất cả —</option>
            {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="Khoá học">
          <select className={inputCls} style={inputStyle} value={khoa} onChange={(e) => setKhoa(e.target.value)}>
            <option value="">— Tất cả —</option>
            {khoaOptions.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
        <Field label="Năm học">
          <select className={inputCls} style={inputStyle} value={namHoc} onChange={(e) => setNamHoc(e.target.value)}>
            <option value="">— Tất cả —</option>
            {NAM_HOC_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
        <div className="flex items-end">
          <Btn onClick={runAssignment} disabled={loading || unassigned.length === 0}>
            <LayoutGrid size={15} /> Chạy bố trí ({unassigned.length} SV)
          </Btn>
        </div>
      </div>

      {msg && <div className="f-body text-sm mb-4" style={{ color: T.green }}>{msg}</div>}

      <div className="stamp-border p-4 mb-5" style={{ background: "#fff" }}>
        <div className="f-display text-sm uppercase tracking-wider mb-1" style={{ color: T.amberDark }}>
          Gợi ý thông minh — xếp theo từng học viên
        </div>
        <p className="f-body text-xs mb-3" style={{ color: T.inkSoft }}>
          Chọn 1 học viên chưa có phòng, hệ thống tự xét giới tính, lớp, khoá và số chỗ còn trống của từng phòng để gợi ý phòng phù hợp nhất, xếp lên trước.
        </p>
        <Field label="Chọn học viên">
          <select className={inputCls} style={inputStyle} value={suggestStudentId} onChange={(e) => setSuggestStudentId(e.target.value)}>
            <option value="">— Chọn học viên cần xếp phòng —</option>
            {unassigned.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.lop ? ` — Lớp ${s.lop}` : ""}{s.khoa ? ` — Khoá ${s.khoa}` : ""}</option>
            ))}
          </select>
        </Field>

        {suggestStudent && (
          suggestions.length === 0 ? (
            <EmptyState text="Không tìm được phòng còn trống, đúng giới tính cho học viên này." />
          ) : (
            <div className="space-y-2 mt-1">
              {suggestions.map(({ room, reasons }, idx) => (
                <div key={room.id} className="flex items-center justify-between gap-3 flex-wrap p-2.5" style={{ border: `1px solid ${T.paperDark}`, background: idx === 0 ? T.paper : "#fff" }}>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="f-display text-sm font-semibold" style={{ color: T.green }}>{roomLabel(room)}</span>
                      {idx === 0 && (
                        <span className="f-display text-[9.5px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm" style={{ background: T.amber, color: T.greenDark }}>Phù hợp nhất</span>
                      )}
                    </div>
                    <div className="f-body text-[11px] mt-1 flex flex-wrap gap-x-2 gap-y-0.5" style={{ color: T.inkSoft }}>
                      {reasons.map((r, i) => <span key={i}>· {r}</span>)}
                    </div>
                  </div>
                  <Btn size="sm" onClick={() => assignOne(suggestStudent.id, room.id)}><CheckCircle2 size={13} /> Xếp vào phòng này</Btn>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {preview && (
        <div className="stamp-border p-4 mb-5" style={{ background: "#fff" }}>
          <div className="f-display text-sm uppercase tracking-wider mb-3" style={{ color: T.amberDark }}>
            Xem trước kết quả bố trí — {preview.assignments.length} sinh viên có thể xếp phòng
          </div>
          {preview.assignments.length === 0 ? (
            <EmptyState text="Không tìm được phòng còn trống phù hợp." />
          ) : (
            <div className="overflow-x-auto stamp-border mb-3" style={{ background: "#fff", maxHeight: 320, overflowY: "auto" }}>
              <table className="w-full text-xs f-body table-lines">
                <thead>
                  <tr className="f-mono text-[10px] uppercase tracking-wider" style={{ background: T.green, color: T.paper, position: "sticky", top: 0 }}>
                    <th className="text-left px-2.5 py-1.5">Sinh viên</th>
                    <th className="text-left px-2.5 py-1.5">Phòng dự kiến</th>
                    <th className="text-left px-2.5 py-1.5">Giường</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.assignments.map((a) => (
                    <tr key={a.studentId} style={{ borderBottom: `1px solid ${T.paperDark}` }}>
                      <td className="px-2.5 py-1.5 font-medium">{a.studentName}</td>
                      <td className="px-2.5 py-1.5 f-mono">{a.roomLabel}</td>
                      <td className="px-2.5 py-1.5 f-mono">{a.bed || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {preview.notPlaced.length > 0 && (
            <div className="f-body text-xs mb-3" style={{ color: T.red }}>
              ⚠ Không đủ chỗ cho {preview.notPlaced.length} sinh viên: {preview.notPlaced.map((s) => s.name).join(", ")}
            </div>
          )}
          <div className="flex gap-2">
            <Btn onClick={confirmAssignment} disabled={preview.assignments.length === 0}><CheckCircle2 size={14} /> Xác nhận, lưu kết quả bố trí</Btn>
            <Btn variant="outline" onClick={() => setPreview(null)}>Huỷ</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   TAB: QUẢN LÝ QUÂN SỐ (danh sách đang ở / đã trả phòng, thống kê theo khoá/lớp/đại đội)
   ============================================================ */
function RosterTab({ perm }) {
  const { items: students, loading } = useSharedList("students");
  const { items: rooms } = useSharedList("rooms");
  const [view, setView] = useState("dang_o"); // dang_o | tra_phong

  const dangO = students.filter((s) => s.status !== "Đã trả phòng");
  const traPhong = students.filter((s) => s.status === "Đã trả phòng");
  const list = view === "dang_o" ? dangO : traPhong;

  const groupCount = (arr, key) => arr.reduce((acc, s) => {
    const k = (s[key] || "").trim() || "Chưa rõ";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const byKhoa = groupCount(dangO, "khoa");
  const byLop = groupCount(dangO, "lop");
  const hasDaiDoi = dangO.some((s) => (s.daiDoi || "").trim());
  const byDaiDoi = hasDaiDoi ? groupCount(dangO, "daiDoi") : null;
  const hasDVTS = dangO.some((s) => (s.donViTuyenSinh || "").trim());
  const byDVTS = hasDVTS ? groupCount(dangO, "donViTuyenSinh") : null;

  const StatBlock = ({ title, data }) => (
    <div className="stamp-border p-4" style={{ background: "#fff" }}>
      <div className="f-display text-sm uppercase tracking-wider mb-3" style={{ color: T.amberDark }}>{title}</div>
      <div className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin">
        {Object.entries(data).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between f-body text-sm">
            <span style={{ color: T.ink }}>{k}</span>
            <span className="f-mono font-semibold" style={{ color: T.green }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <SectionHeader icon={Users} eyebrow="Quản lý" title="Quản lý quân số" />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatBlock title="Thống kê theo khoá" data={byKhoa} />
        <StatBlock title="Thống kê theo lớp" data={byLop} />
        {byDaiDoi ? <StatBlock title="Thống kê theo đại đội" data={byDaiDoi} /> : (
          <div className="stamp-border p-4 flex items-center justify-center" style={{ background: "#fff" }}>
            <span className="f-body text-xs italic text-center" style={{ color: T.inkSoft }}>Chưa có dữ liệu đại đội — có thể bổ sung khi thêm/sửa học viên.</span>
          </div>
        )}
        {byDVTS ? <StatBlock title="Thống kê theo đơn vị tuyển sinh" data={byDVTS} /> : (
          <div className="stamp-border p-4 flex items-center justify-center" style={{ background: "#fff" }}>
            <span className="f-body text-xs italic text-center" style={{ color: T.inkSoft }}>Chưa có dữ liệu đơn vị tuyển sinh — có thể bổ sung khi thêm/sửa học viên.</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setView("dang_o")}
          className="f-display text-xs uppercase tracking-wide px-3 py-1.5 rounded-sm btn-press"
          style={{ background: view === "dang_o" ? T.green : "transparent", color: view === "dang_o" ? "#fff" : T.green, border: `1px solid ${T.green}` }}
        >
          Đang ở nội trú ({dangO.length})
        </button>
        <button
          onClick={() => setView("tra_phong")}
          className="f-display text-xs uppercase tracking-wide px-3 py-1.5 rounded-sm btn-press"
          style={{ background: view === "tra_phong" ? T.red : "transparent", color: view === "tra_phong" ? "#fff" : T.red, border: `1px solid ${T.red}` }}
        >
          Đã trả phòng ({traPhong.length})
        </button>
      </div>

      {loading ? <LoadingRow /> : list.length === 0 ? <EmptyState text="Không có học viên nào trong danh sách này." /> : (
        <div className="overflow-x-auto stamp-border card-sheet" style={{ background: "#fff" }}>
          <table className="w-full text-sm f-body table-lines">
            <thead>
              <tr className="f-mono text-[11px] uppercase tracking-wider" style={{ background: T.green, color: T.paper }}>
                <th className="text-left px-3 py-2">Mã SV</th>
                <th className="text-left px-3 py-2">Họ tên</th>
                <th className="text-left px-3 py-2">Khoá/Lớp</th>
                <th className="text-left px-3 py-2">Phòng</th>
                <th className="text-left px-3 py-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s, i) => {
                const room = rooms.find((r) => r.id === s.roomId);
                return (
                  <tr key={s.id} style={{ background: i % 2 ? T.paper : "#fff" }}>
                    <td className="px-3 py-2 f-mono">{s.msv || "—"}</td>
                    <td className="px-3 py-2 font-medium">{s.name}</td>
                    <td className="px-3 py-2 f-mono">{s.khoa || "—"} / {s.lop || "—"}</td>
                    <td className="px-3 py-2 f-mono">{room ? roomLabel(room) : "—"}</td>
                    <td className="px-3 py-2">{s.status || "Chưa xếp phòng"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   TAB: TÀI SẢN & THIẾT BỊ TRONG PHÒNG (điện, nước, cơ sở vật chất)
   ============================================================ */
/* ============ NHẬP DANH SÁCH TÀI SẢN TỪ EXCEL/CSV ============ */
function guessAssetField(header) {
  const h = String(header || "").toLowerCase();
  if (/số\s*phòng|^phòng$|room/.test(h)) return "roomNumber";
  if (/tên|thiết\s*bị|tài\s*sản|name/.test(h)) return "name";
  if (/phân\s*loại|loại|category/.test(h)) return "category";
  if (/số\s*lượng|sl|quantity/.test(h)) return "quantity";
  if (/tình\s*trạng|trạng\s*thái|status/.test(h)) return "status";
  if (/ghi\s*chú|note/.test(h)) return "note";
  return "";
}
const ASSET_IMPORT_FIELDS = [
  { key: "", label: "— Bỏ qua cột này —" },
  { key: "roomNumber", label: "Số phòng (để khớp phòng)" },
  { key: "name", label: "Tên thiết bị / tài sản" },
  { key: "category", label: "Phân loại" },
  { key: "quantity", label: "Số lượng" },
  { key: "status", label: "Tình trạng" },
  { key: "note", label: "Ghi chú" },
];

function AssetImportPanel({ rooms, user, onConfirm, onClose }) {
  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [colMap, setColMap] = useState([]);
  const [fileErr, setFileErr] = useState("");
  const [fileBusy, setFileBusy] = useState(false);
  const [selectedRows, setSelectedRows] = useState({});

  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileErr(""); setFileBusy(true);
    try {
      const isCsv = /\.csv$/i.test(file.name);
      let rows = [];
      if (isCsv) {
        rows = parseCSVText(await file.text());
      } else {
        const XLSX = await loadXLSXLib();
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" })
          .map((r) => r.map((c) => String(c ?? "")))
          .filter((r) => r.some((c) => String(c).trim() !== ""));
      }
      if (rows.length === 0) { setFileErr("Không đọc được dữ liệu nào từ file này."); setFileBusy(false); return; }
      const colCount = Math.max(...rows.map((r) => r.length));
      const headerRow = rows[0] || [];
      setColMap(Array.from({ length: colCount }, (_, i) => guessAssetField(headerRow[i])));
      setRawRows(rows);
      setFileName(file.name);
      setSelectedRows({});
    } catch (err) {
      setFileErr(`Đọc file thất bại — ${err?.message || err}`);
    }
    setFileBusy(false);
  };

  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
  const previewRows = dataRows.map((r) => {
    const o = { roomNumber: "", name: "", category: "", quantity: "", status: "", note: "" };
    colMap.forEach((key, i) => { if (key && r[i] !== undefined) o[key] = String(r[i]).trim(); });
    if (!ASSET_CATEGORY.includes(o.category)) o.category = "Cơ sở vật chất";
    if (!ASSET_STATUS.includes(o.status)) o.status = "Tốt";
    const matched = rooms.find((rm) => normalizeName(rm.roomNumber) === normalizeName(o.roomNumber));
    return { ...o, matchedRoomId: matched ? matched.id : null, matchedRoomLabel: matched ? roomLabel(matched) : null };
  });

  useEffect(() => {
    const next = {};
    previewRows.forEach((r, i) => { next[i] = Boolean(r.name && r.matchedRoomId); });
    setSelectedRows(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewRows.length]);

  const toggleRow = (i) => setSelectedRows((s) => ({ ...s, [i]: !s[i] }));
  const checkedCount = Object.values(selectedRows).filter(Boolean).length;

  const confirmImport = () => {
    const chosen = previewRows.filter((r, i) => selectedRows[i] && r.name && r.matchedRoomId);
    if (chosen.length === 0) return;
    onConfirm(chosen.map((r, idx) => ({
      id: Date.now() + idx,
      roomId: r.matchedRoomId,
      name: r.name,
      category: r.category || "Cơ sở vật chất",
      quantity: r.quantity || "1",
      status: r.status || "Tốt",
      note: r.note || "",
      updatedAt: new Date().toISOString(),
      by: user,
    })));
  };

  return (
    <div className="stamp-border p-3 mb-3" style={{ background: "#fff" }}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <span className="f-display text-[11.5px] uppercase tracking-wider" style={{ color: T.amberDark }}>Nhập danh sách tài sản từ Excel/CSV</span>
        <button onClick={onClose} title="Đóng"><X size={16} style={{ color: T.inkSoft }} /></button>
      </div>
      <p className="f-body text-[11px] italic mb-2" style={{ color: T.inkSoft }}>
        File cần có cột "Số phòng" đúng với số phòng đã có trong hệ thống để khớp tài sản vào đúng phòng — dòng không khớp được phòng nào sẽ không thể chọn.
      </p>
      <label className="f-display text-[11px] uppercase tracking-wider px-3 py-1.5 inline-flex items-center gap-1.5 cursor-pointer btn-press" style={{ border: `1px solid ${T.green}`, color: T.green }}>
        {fileBusy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
        {fileBusy ? "Đang đọc file…" : "Chọn file từ máy"}
        <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFilePicked} />
      </label>
      {fileName && <span className="f-body text-[11px] ml-2" style={{ color: T.inkSoft }}>Đã chọn: {fileName}</span>}
      {fileErr && <div className="f-body text-xs mt-2" style={{ color: T.red }}>{fileErr}</div>}

      {rawRows.length > 0 && (
        <>
          <label className="flex items-center gap-2 mt-3 f-body text-xs cursor-pointer" style={{ color: T.ink }}>
            <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
            Dòng đầu tiên là tiêu đề cột (không lấy làm dữ liệu)
          </label>
          <div className="f-mono text-[10.5px] uppercase tracking-widest mt-3 mb-1" style={{ color: T.amberDark }}>Chọn cột nào ứng với thông tin nào</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-3">
            {colMap.map((val, i) => (
              <div key={i}>
                <div className="f-body text-[10px] truncate mb-0.5" style={{ color: T.inkSoft }} title={rawRows[0]?.[i]}>
                  Cột {i + 1}{hasHeader && rawRows[0]?.[i] ? `: "${rawRows[0][i]}"` : ""}
                </div>
                <select className={inputCls} style={{ ...inputStyle, fontSize: "11.5px", padding: "4px 6px" }} value={val} onChange={(e) => setColMap((cm) => cm.map((v, ci) => (ci === i ? e.target.value : v)))}>
                  {ASSET_IMPORT_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </>
      )}

      {previewRows.length > 0 && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2 mt-4 mb-1.5">
            <span className="f-mono text-[11px] uppercase tracking-widest" style={{ color: T.amberDark }}>Xem trước — tick chọn dòng cần lấy ({checkedCount}/{previewRows.length})</span>
          </div>
          <div className="overflow-x-auto overflow-y-auto stamp-border" style={{ background: "#fff", maxHeight: 320 }}>
            <table className="w-full text-xs f-body table-lines table-grid">
              <thead>
                <tr className="f-mono text-[10px] uppercase tracking-wider" style={{ background: T.green, color: T.paper, position: "sticky", top: 0, zIndex: 1 }}>
                  <th className="px-2 py-1.5 w-8"></th>
                  <th className="text-left px-2 py-1.5">Số phòng (khớp)</th>
                  <th className="text-left px-2 py-1.5 min-w-[110px]">Tên thiết bị</th>
                  <th className="text-left px-2 py-1.5">Phân loại</th>
                  <th className="text-left px-2 py-1.5">SL</th>
                  <th className="text-left px-2 py-1.5">Tình trạng</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 ? T.paper : "#fff" }}>
                    <td className="px-2 py-1.5 text-center">
                      <input type="checkbox" checked={Boolean(selectedRows[i])} disabled={!r.matchedRoomId} onChange={() => toggleRow(i)} />
                    </td>
                    <td className="px-2 py-1.5 f-mono">
                      {r.matchedRoomLabel || <span className="italic" style={{ color: T.red }}>Không khớp phòng "{r.roomNumber || "?"}"</span>}
                    </td>
                    <td className="px-2 py-1.5 font-medium">{r.name || <span className="italic" style={{ color: T.inkSoft }}>(thiếu tên)</span>}</td>
                    <td className="px-2 py-1.5">{r.category}</td>
                    <td className="px-2 py-1.5 f-mono">{r.quantity || 1}</td>
                    <td className="px-2 py-1.5">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Btn onClick={confirmImport} disabled={checkedCount === 0}><CheckCircle2 size={14} /> Xác nhận, thêm {checkedCount} tài sản</Btn>
            <Btn variant="outline" onClick={onClose}>Huỷ</Btn>
          </div>
        </>
      )}
    </div>
  );
}

const ASSET_BLANK = { roomId: "", name: "", category: "Cơ sở vật chất", quantity: "1", status: "Tốt", note: "", imageUrl: "" };

function AssetsTab({ perm, user }) {
  const { items: assets, setItems: setAssets, loading } = useSharedList("assets");
  const { items: rooms } = useSharedList("rooms");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState(ASSET_BLANK);
  const [warn, setWarn] = useState("");
  const [filterRoom, setFilterRoom] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const add = async () => {
    if (!form.roomId || !form.name.trim()) { setWarn("Vui lòng chọn Phòng và nhập Tên thiết bị/tài sản trước khi lưu."); return; }
    setWarn("");
    await setAssets([...assets, { id: Date.now(), ...form, roomId: Number(form.roomId), updatedAt: new Date().toISOString(), by: user }]);
    setForm(ASSET_BLANK);
    setShowForm(false);
  };
  const remove = async (id) => setAssets(assets.filter((a) => a.id !== id));
  const startEdit = (a) => { setEditingId(a.id); setEditForm({ ...a }); };
  const saveEdit = async () => {
    await setAssets(assets.map((a) => (a.id === editingId ? { ...editForm, roomId: Number(editForm.roomId), updatedAt: new Date().toISOString() } : a)));
    setEditingId(null); setEditForm(null);
  };

  const filtered = assets.filter((a) =>
    (!filterRoom || String(a.roomId) === filterRoom) && (!filterCategory || a.category === filterCategory)
  );

  const checkInventory = async (id) => setAssets(assets.map((a) => (a.id === id ? { ...a, lastCheckedAt: new Date().toISOString(), lastCheckedBy: user } : a)));
  const liquidate = async (id) => setAssets(assets.map((a) => (a.id === id ? { ...a, status: "Đã thanh lý", updatedAt: new Date().toISOString() } : a)));

  const statusColor = { "Tốt": T.green, "Hỏng": T.red, "Đang sửa": T.amberDark, "Đã thanh lý": T.inkSoft };

  return (
    <div>
      <SectionHeader compact icon={Boxes} eyebrow={`Tổng số mục: ${assets.length}`} title="Tài sản & thiết bị trong phòng"
        action={perm.canMaintain && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Btn size="sm" variant="outline" onClick={() => setShowImport((s) => !s)}><Upload size={14} /> Nhập từ Excel/CSV</Btn>
            <Btn size="sm" onClick={() => (showForm ? setShowForm(false) : setShowForm(true))}><Plus size={14} /> Thêm tài sản</Btn>
          </div>
        )} />
      <p className="f-body text-xs mb-4" style={{ color: T.inkSoft }}>
        Ghi nhận tài sản/thiết bị theo từng phòng: hệ thống điện - nước, quạt, giường tủ, bàn ghế và các cơ sở vật chất khác.
      </p>

      {perm.canMaintain && showImport && (
        <AssetImportPanel
          rooms={rooms}
          user={user}
          onClose={() => setShowImport(false)}
          onConfirm={async (newAssets) => {
            await setAssets([...assets, ...newAssets]);
            setShowImport(false);
          }}
        />
      )}

      {perm.canMaintain && showForm && (
        <div className="stamp-border p-4 mb-5 grid grid-cols-1 md:grid-cols-3 gap-3" style={{ background: "#fff" }}>
          <div className="md:col-span-3"><FormWarning message={warn} /></div>
          <Field label="Phòng" required>
            <select className={inputCls} style={inputStyle} value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
              <option value="">— Chọn phòng —</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{roomLabel(r)}</option>)}
            </select>
          </Field>
          <Field label="Tên thiết bị / tài sản" required><input className={inputCls} style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: Quạt trần, Vòi nước, Bóng đèn…" /></Field>
          <Field label="Phân loại">
            <select className={inputCls} style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {ASSET_CATEGORY.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Số lượng"><input type="number" min="1" className={inputCls} style={inputStyle} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
          <Field label="Tình trạng">
            <select className={inputCls} style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {ASSET_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Ghi chú"><input className={inputCls} style={inputStyle} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          <div className="md:col-span-3">
            <Field label="Ảnh tài sản (tuỳ chọn)">
              <UploadField onUploaded={(url) => setForm((f) => ({ ...f, imageUrl: url }))} />
              {form.imageUrl && (
                <div className="flex items-center gap-2 mt-2">
                  <img src={form.imageUrl} alt="Ảnh tài sản" className="w-20 h-20 object-cover stamp-border" />
                  <button type="button" onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))} className="f-mono text-[10px] underline" style={{ color: T.red }}>Xoá ảnh</button>
                </div>
              )}
            </Field>
          </div>
          <div className="md:col-span-3"><Btn onClick={add}>Lưu</Btn></div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <select className={inputCls} style={{ ...inputStyle, width: "auto" }} value={filterRoom} onChange={(e) => setFilterRoom(e.target.value)}>
          <option value="">— Tất cả phòng —</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{roomLabel(r)}</option>)}
        </select>
        <select className={inputCls} style={{ ...inputStyle, width: "auto" }} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="">— Tất cả phân loại —</option>
          {ASSET_CATEGORY.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? <LoadingRow /> : filtered.length === 0 ? <EmptyState text="Chưa có tài sản/thiết bị nào phù hợp." /> : (
        <div className="overflow-x-auto stamp-border card-sheet" style={{ background: "#fff" }}>
          <table className="w-full text-sm f-body table-lines">
            <thead>
              <tr className="f-mono text-[11px] uppercase tracking-wider" style={{ background: T.green, color: T.paper }}>
                <th className="text-left px-3 py-2">Phòng</th>
                <th className="text-left px-3 py-2">Ảnh</th>
                <th className="text-left px-3 py-2">Tên thiết bị</th>
                <th className="text-left px-3 py-2">Phân loại</th>
                <th className="text-left px-3 py-2">SL</th>
                <th className="text-left px-3 py-2">Tình trạng</th>
                <th className="text-left px-3 py-2">Ghi chú</th>
                <th className="text-left px-3 py-2">Kiểm kê lần cuối</th>
                <th className="px-3 py-2 w-28"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => {
                const room = rooms.find((r) => r.id === a.roomId);
                if (editingId === a.id) {
                  return (
                    <tr key={a.id}><td colSpan={9} className="p-2">
                      <div className="stamp-border p-3 grid grid-cols-1 md:grid-cols-3 gap-2" style={{ background: T.paper }}>
                        <Field label="Phòng">
                          <select className={inputCls} style={inputStyle} value={editForm.roomId} onChange={(e) => setEditForm({ ...editForm, roomId: e.target.value })}>
                            {rooms.map((r) => <option key={r.id} value={r.id}>{roomLabel(r)}</option>)}
                          </select>
                        </Field>
                        <Field label="Tên thiết bị"><input className={inputCls} style={inputStyle} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></Field>
                        <Field label="Phân loại">
                          <select className={inputCls} style={inputStyle} value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                            {ASSET_CATEGORY.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </Field>
                        <Field label="Số lượng"><input type="number" className={inputCls} style={inputStyle} value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} /></Field>
                        <Field label="Tình trạng">
                          <select className={inputCls} style={inputStyle} value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                            {ASSET_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </Field>
                        <Field label="Ghi chú"><input className={inputCls} style={inputStyle} value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} /></Field>
                        <div className="md:col-span-3">
                          <Field label="Ảnh tài sản (tuỳ chọn)">
                            <UploadField onUploaded={(url) => setEditForm((f) => ({ ...f, imageUrl: url }))} />
                            {editForm.imageUrl && (
                              <div className="flex items-center gap-2 mt-2">
                                <img src={editForm.imageUrl} alt="Ảnh tài sản" className="w-20 h-20 object-cover stamp-border" />
                                <button type="button" onClick={() => setEditForm((f) => ({ ...f, imageUrl: "" }))} className="f-mono text-[10px] underline" style={{ color: T.red }}>Xoá ảnh</button>
                              </div>
                            )}
                          </Field>
                        </div>
                        <div className="md:col-span-3 flex gap-2"><Btn onClick={saveEdit}>Lưu</Btn><Btn variant="outline" onClick={() => setEditingId(null)}>Huỷ</Btn></div>
                      </div>
                    </td></tr>
                  );
                }
                return (
                  <tr key={a.id} onClick={() => setSelectedId((id) => (id === a.id ? null : a.id))} className="cursor-pointer" style={withSelect({ background: i % 2 ? T.paper : "#fff" }, selectedId === a.id)}>
                    <td className="px-3 py-2 f-mono">{room ? roomLabel(room) : "—"}</td>
                    <td className="px-3 py-2">
                      {a.imageUrl ? (
                        <div className="relative w-12 h-12 group">
                          <img src={a.imageUrl} alt={a.name} className="w-12 h-12 object-cover stamp-border" />
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); downloadFileFromUrl(a.imageUrl, `tai-san-${(a.name || "item").replace(/\s+/g, "-")}.jpg`); }}
                            title="Tải ảnh về máy"
                            className="absolute -bottom-1 -right-1 p-1 rounded-full"
                            style={{ background: T.green, color: "#fff", border: `1px solid #fff` }}
                          >
                            <Upload size={9} style={{ transform: "rotate(180deg)", display: "block" }} />
                          </button>
                        </div>
                      ) : <span style={{ color: T.inkSoft }}>—</span>}
                    </td>
                    <td className="px-3 py-2 font-medium">{a.name}</td>
                    <td className="px-3 py-2">{a.category}</td>
                    <td className="px-3 py-2 f-mono">{a.quantity || 1}</td>
                    <td className="px-3 py-2">
                      <span className="f-mono text-[10px] uppercase px-1.5 py-0.5 rounded-sm" style={{ background: statusColor[a.status] || T.green, color: "#fff" }}>{a.status}</span>
                    </td>
                    <td className="px-3 py-2" style={{ color: T.inkSoft }}>{a.note}</td>
                    <td className="px-3 py-2 f-mono text-[11px]" style={{ color: T.inkSoft }}>
                      {a.lastCheckedAt ? `${formatDateTime(a.lastCheckedAt)}${a.lastCheckedBy ? ` · ${a.lastCheckedBy}` : ""}` : "Chưa kiểm kê"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {perm.canMaintain && (
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <button onClick={(e) => { e.stopPropagation(); checkInventory(a.id); }} title="Đánh dấu đã kiểm kê"><CheckCircle2 size={13} style={{ color: T.amberDark }} /></button>
                          {a.status !== "Đã thanh lý" && (
                            <button onClick={(e) => { e.stopPropagation(); liquidate(a.id); }} title="Thanh lý tài sản"><AlertTriangle size={13} style={{ color: T.red }} /></button>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); startEdit(a); }} title="Sửa"><Pencil size={13} style={{ color: T.green }} /></button>
                          <button onClick={(e) => { e.stopPropagation(); remove(a.id); }} title="Xoá"><Trash2 size={13} style={{ color: T.red }} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   TAB: QUẢN LÝ BẢO TRÌ (sinh viên gửi yêu cầu, kỹ thuật cập nhật trạng thái)
   ============================================================ */
function MaintenanceTab({ perm, user }) {
  const { items: requests, setItems: setRequests, loading } = useSharedList("maintenance");
  const { items: rooms } = useSharedList("rooms");
  const { items: permissions } = useSharedList("permissions");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ roomId: "", title: "", description: "", imageUrl: "" });
  const [warn, setWarn] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [noteDraft, setNoteDraft] = useState({});
  const [assignDraft, setAssignDraft] = useState({});

  const technicians = permissions.filter((p) => p.role === "ky_thuat").map((p) => p.name);

  const submit = async () => {
    if (!form.roomId || !form.title.trim()) { setWarn("Vui lòng chọn Phòng và nhập Nội dung yêu cầu trước khi gửi."); return; }
    setWarn("");
    await setRequests([
      { id: Date.now(), roomId: Number(form.roomId), title: form.title, description: form.description, imageUrl: form.imageUrl, reporterName: user, status: "Chờ xử lý", createdAt: new Date().toISOString(), technicianNote: "", assignedTo: "" },
      ...requests,
    ]);
    setForm({ roomId: "", title: "", description: "", imageUrl: "" });
    setShowForm(false);
  };
  const remove = async (id) => setRequests(requests.filter((r) => r.id !== id));
  const updateStatus = async (id, status) => {
    await setRequests(requests.map((r) => (r.id === id ? { ...r, status } : r)));
  };
  const saveNote = async (id) => {
    await setRequests(requests.map((r) => (r.id === id ? { ...r, technicianNote: noteDraft[id] ?? r.technicianNote } : r)));
  };
  const saveAssign = async (id) => {
    await setRequests(requests.map((r) => (r.id === id ? { ...r, assignedTo: assignDraft[id] ?? r.assignedTo } : r)));
  };

  const canDelete = (r) => perm.canMaintain || perm.isOwner(r.reporterName);
  const filtered = filterStatus ? requests.filter((r) => r.status === filterStatus) : requests;
  const statusColor = { "Chờ xử lý": T.red, "Đang xử lý": T.amberDark, "Hoàn thành": T.green, "Từ chối": T.inkSoft };

  return (
    <div>
      <SectionHeader compact icon={Wrench} eyebrow={`Tổng số yêu cầu: ${requests.length}`} title="Quản lý bảo trì"
        action={<Btn size="sm" onClick={() => (showForm ? setShowForm(false) : setShowForm(true))}><Plus size={14} /> Gửi yêu cầu sửa chữa</Btn>} />

      {showForm && (
        <div className="stamp-border p-4 mb-5 grid grid-cols-1 md:grid-cols-2 gap-3" style={{ background: "#fff" }}>
          <div className="md:col-span-2"><FormWarning message={warn} /></div>
          <Field label="Phòng" required>
            <select className={inputCls} style={inputStyle} value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
              <option value="">— Chọn phòng —</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{roomLabel(r)}</option>)}
            </select>
          </Field>
          <Field label="Nội dung yêu cầu" required><input className={inputCls} style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="VD: Hỏng bóng đèn, rò rỉ nước…" /></Field>
          <div className="md:col-span-2">
            <Field label="Mô tả chi tiết"><textarea rows={3} className={inputCls} style={inputStyle} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Ảnh minh hoạ (tuỳ chọn)">
              <UploadField onUploaded={(url) => setForm((f) => ({ ...f, imageUrl: url }))} />
              {form.imageUrl && <img src={form.imageUrl} alt="Ảnh yêu cầu" className="w-20 h-20 object-cover stamp-border mt-2" />}
            </Field>
          </div>
          <div className="md:col-span-2"><Btn onClick={submit}>Gửi yêu cầu</Btn></div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <select className={inputCls} style={{ ...inputStyle, width: "auto" }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">— Tất cả trạng thái —</option>
          {MAINT_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? <LoadingRow /> : filtered.length === 0 ? <EmptyState text="Chưa có yêu cầu bảo trì nào." /> : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const room = rooms.find((x) => x.id === r.roomId);
            return (
              <div key={r.id} onClick={() => setSelectedId((id) => (id === r.id ? null : r.id))} className="stamp-border p-3 cursor-pointer" style={withSelect({ background: "#fff" }, selectedId === r.id)}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="f-body text-sm font-semibold" style={{ color: T.ink }}>{r.title}</div>
                    <div className="f-mono text-[10.5px]" style={{ color: T.inkSoft }}>
                      {room ? roomLabel(room) : "—"} · Người gửi: {r.reporterName} · {formatDateTime(r.createdAt)}
                    </div>
                  </div>
                  <span className="f-display text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm shrink-0" style={{ background: statusColor[r.status] || T.green, color: "#fff" }}>{r.status}</span>
                </div>
                {r.description && <div className="f-body text-xs mt-2" style={{ color: T.ink }}>{r.description}</div>}
                {r.imageUrl && <img src={r.imageUrl} alt="Ảnh yêu cầu" className="w-20 h-20 object-cover stamp-border mt-2" />}

                {perm.canMaintain && (
                  <div className="mt-3 pt-3 flex flex-wrap items-center gap-2" style={{ borderTop: `1px dashed ${T.paperDark}` }} onClick={(e) => e.stopPropagation()}>
                    <span className="f-mono text-[10.5px] uppercase tracking-widest" style={{ color: T.amberDark }}>Phân công kỹ thuật:</span>
                    <input
                      list="technician-names"
                      className={inputCls}
                      style={{ ...inputStyle, fontSize: "12px", width: 200 }}
                      placeholder="Tên người phụ trách…"
                      value={assignDraft[r.id] ?? r.assignedTo ?? ""}
                      onChange={(e) => setAssignDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                    />
                    <datalist id="technician-names">
                      {technicians.map((t) => <option key={t} value={t} />)}
                    </datalist>
                    <Btn size="sm" variant="outline" onClick={() => saveAssign(r.id)}>Lưu</Btn>
                  </div>
                )}
                {!perm.canMaintain && r.assignedTo && (
                  <div className="f-body text-xs mt-2" style={{ color: T.inkSoft }}>Phụ trách: <b style={{ color: T.ink }}>{r.assignedTo}</b></div>
                )}

                {perm.canMaintain && (
                  <div className="mt-3 pt-3 flex flex-wrap items-center gap-2" style={{ borderTop: `1px dashed ${T.paperDark}` }} onClick={(e) => e.stopPropagation()}>
                    <span className="f-mono text-[10.5px] uppercase tracking-widest" style={{ color: T.amberDark }}>Cập nhật trạng thái:</span>
                    {MAINT_STATUS.map((s) => (
                      <button
                        key={s}
                        onClick={() => updateStatus(r.id, s)}
                        className="f-display text-[10px] uppercase tracking-wide px-2 py-1 rounded-sm btn-press"
                        style={{ background: r.status === s ? (statusColor[s] || T.green) : "transparent", color: r.status === s ? "#fff" : T.green, border: `1px solid ${statusColor[s] || T.green}` }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {perm.canMaintain && (
                  <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      className={inputCls}
                      style={{ ...inputStyle, fontSize: "12px" }}
                      placeholder="Ghi chú của bộ phận kỹ thuật…"
                      value={noteDraft[r.id] ?? r.technicianNote ?? ""}
                      onChange={(e) => setNoteDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                    />
                    <Btn size="sm" onClick={() => saveNote(r.id)}>Lưu ghi chú</Btn>
                  </div>
                )}
                {!perm.canMaintain && r.technicianNote && (
                  <div className="f-body text-xs mt-2 italic" style={{ color: T.inkSoft }}>Ghi chú kỹ thuật: {r.technicianNote}</div>
                )}

                {canDelete(r) && (
                  <div className="mt-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => remove(r.id)} className="f-mono text-[10px] underline" style={{ color: T.red }}>Xoá yêu cầu</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   TAB: QUẢN LÝ ĐIỆN - NƯỚC (nhập chỉ số, thống kê tiêu thụ, báo cáo theo tháng)
   ============================================================ */
function UtilitiesTab({ perm, user }) {
  const { items: records, setItems: setRecords, loading } = useSharedList("utilities");
  const { items: rooms } = useSharedList("rooms");
  const [showForm, setShowForm] = useState(false);
  const blank = { roomId: "", month: new Date().toISOString().slice(0, 7), electricityIndex: "", waterIndex: "" };
  const [form, setForm] = useState(blank);
  const [warn, setWarn] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editWarn, setEditWarn] = useState("");

  const submit = async () => {
    if (!form.roomId || !form.month) { setWarn("Vui lòng chọn Phòng và Tháng trước khi lưu."); return; }
    if (records.some((r) => String(r.roomId) === String(form.roomId) && r.month === form.month)) {
      setWarn("Phòng này đã có chỉ số điện/nước cho tháng đã chọn. Hãy sửa bản ghi cũ thay vì thêm mới.");
      return;
    }
    setWarn("");
    await setRecords([
      { id: Date.now(), roomId: Number(form.roomId), month: form.month, electricityIndex: Number(form.electricityIndex) || 0, waterIndex: Number(form.waterIndex) || 0, by: user, createdAt: new Date().toISOString() },
      ...records,
    ]);
    setForm(blank);
    setShowForm(false);
  };
  const remove = async (id) => setRecords(records.filter((r) => r.id !== id));

  const startEdit = (r) => { setEditingId(r.id); setEditForm({ roomId: r.roomId, month: r.month, electricityIndex: String(r.electricityIndex), waterIndex: String(r.waterIndex) }); setEditWarn(""); };
  const cancelEdit = () => { setEditingId(null); setEditForm(null); setEditWarn(""); };
  const saveEdit = async () => {
    if (!editForm.roomId || !editForm.month) { setEditWarn("Vui lòng chọn đủ Phòng và Tháng."); return; }
    if (records.some((r) => r.id !== editingId && String(r.roomId) === String(editForm.roomId) && r.month === editForm.month)) {
      setEditWarn("Phòng này đã có chỉ số điện/nước cho tháng đã chọn ở một bản ghi khác.");
      return;
    }
    await setRecords(records.map((r) => (r.id === editingId
      ? { ...r, roomId: Number(editForm.roomId), month: editForm.month, electricityIndex: Number(editForm.electricityIndex) || 0, waterIndex: Number(editForm.waterIndex) || 0, editedBy: user, editedAt: new Date().toISOString() }
      : r)));
    cancelEdit();
  };

  // Tính tiêu thụ = chỉ số tháng này - chỉ số tháng liền trước (cùng phòng)
  const withUsage = records.map((r) => {
    const prevRecords = records
      .filter((x) => String(x.roomId) === String(r.roomId) && x.month < r.month)
      .sort((a, b) => String(b.month).localeCompare(String(a.month)));
    const prev = prevRecords[0];
    return {
      ...r,
      elecUsage: prev ? r.electricityIndex - prev.electricityIndex : null,
      waterUsage: prev ? r.waterIndex - prev.waterIndex : null,
    };
  });

  const months = [...new Set(records.map((r) => r.month))].sort().reverse();
  const filtered = withUsage.filter((r) => !filterMonth || r.month === filterMonth).sort((a, b) => String(b.month).localeCompare(String(a.month)));

  const monthTotal = (month) => {
    const rows = withUsage.filter((r) => r.month === month);
    return {
      elec: rows.reduce((s, r) => s + (r.elecUsage || 0), 0),
      water: rows.reduce((s, r) => s + (r.waterUsage || 0), 0),
      count: rows.length,
    };
  };

  return (
    <div>
      <SectionHeader compact icon={Zap} eyebrow={`Tổng số bản ghi: ${records.length}`} title="Quản lý điện - nước"
        action={perm.canMaintain && (
          <Btn size="sm" onClick={() => (showForm ? setShowForm(false) : setShowForm(true))}><Plus size={14} /> Nhập chỉ số</Btn>
        )} />
      <p className="f-body text-xs mb-4" style={{ color: T.inkSoft }}>
        Nhập chỉ số điện - nước hàng tháng theo từng phòng. Hệ thống tự tính mức tiêu thụ so với tháng liền trước.
      </p>

      {perm.canMaintain && showForm && (
        <div className="stamp-border p-4 mb-5 grid grid-cols-1 md:grid-cols-2 gap-3" style={{ background: "#fff" }}>
          <div className="md:col-span-2"><FormWarning message={warn} /></div>
          <Field label="Phòng" required>
            <select className={inputCls} style={inputStyle} value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
              <option value="">— Chọn phòng —</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{roomLabel(r)}</option>)}
            </select>
          </Field>
          <Field label="Tháng" required>
            <input type="month" className={inputCls} style={inputStyle} value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} />
          </Field>
          <Field label="Chỉ số điện (kWh)" required>
            <input type="number" className={inputCls} style={inputStyle} value={form.electricityIndex} onChange={(e) => setForm({ ...form, electricityIndex: e.target.value })} />
          </Field>
          <Field label="Chỉ số nước (m³)" required>
            <input type="number" className={inputCls} style={inputStyle} value={form.waterIndex} onChange={(e) => setForm({ ...form, waterIndex: e.target.value })} />
          </Field>
          <div className="md:col-span-2"><Btn onClick={submit}>Lưu chỉ số</Btn></div>
        </div>
      )}

      {months.length > 0 && (
        <div className="stamp-border p-4 mb-5" style={{ background: "#fff" }}>
          <div className="f-display text-sm uppercase tracking-wider mb-3" style={{ color: T.amberDark }}>Thống kê tiêu thụ theo tháng</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm f-body table-lines">
              <thead>
                <tr className="f-mono text-[10.5px] uppercase tracking-wider" style={{ background: T.green, color: T.paper }}>
                  <th className="text-left px-3 py-2">Tháng</th>
                  <th className="text-left px-3 py-2">Số phòng có dữ liệu</th>
                  <th className="text-left px-3 py-2">Tổng điện tiêu thụ (kWh)</th>
                  <th className="text-left px-3 py-2">Tổng nước tiêu thụ (m³)</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m, i) => {
                  const t = monthTotal(m);
                  return (
                    <tr key={m} style={{ background: i % 2 ? T.paper : "#fff" }}>
                      <td className="px-3 py-2 f-mono font-medium" style={{ color: T.green }}>{formatMonth(m)}</td>
                      <td className="px-3 py-2 f-mono">{t.count}</td>
                      <td className="px-3 py-2 f-mono">{t.elec}</td>
                      <td className="px-3 py-2 f-mono">{t.water}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <select className={inputCls} style={{ ...inputStyle, width: "auto" }} value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
          <option value="">— Tất cả các tháng —</option>
          {months.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
        </select>
      </div>

      {loading ? <LoadingRow /> : filtered.length === 0 ? <EmptyState text="Chưa có dữ liệu điện - nước phù hợp." /> : (
        <div className="overflow-x-auto stamp-border card-sheet" style={{ background: "#fff" }}>
          <table className="w-full text-sm f-body table-lines">
            <thead>
              <tr className="f-mono text-[11px] uppercase tracking-wider" style={{ background: T.green, color: T.paper }}>
                <th className="text-left px-3 py-2">Phòng</th>
                <th className="text-left px-3 py-2">Tháng</th>
                <th className="text-left px-3 py-2">Chỉ số điện</th>
                <th className="text-left px-3 py-2">Điện tiêu thụ</th>
                <th className="text-left px-3 py-2">Chỉ số nước</th>
                <th className="text-left px-3 py-2">Nước tiêu thụ</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const room = rooms.find((x) => x.id === r.roomId);
                if (editingId === r.id) {
                  return (
                    <tr key={r.id}><td colSpan={7} className="p-2">
                      <div className="stamp-border p-3 grid grid-cols-1 md:grid-cols-2 gap-2" style={{ background: T.paper }}>
                        <div className="md:col-span-2"><FormWarning message={editWarn} /></div>
                        <Field label="Phòng">
                          <select className={inputCls} style={inputStyle} value={editForm.roomId} onChange={(e) => setEditForm({ ...editForm, roomId: e.target.value })}>
                            {rooms.map((rm) => <option key={rm.id} value={rm.id}>{roomLabel(rm)}</option>)}
                          </select>
                        </Field>
                        <Field label="Tháng">
                          <input type="month" className={inputCls} style={inputStyle} value={editForm.month} onChange={(e) => setEditForm({ ...editForm, month: e.target.value })} />
                        </Field>
                        <Field label="Chỉ số điện (kWh)">
                          <input type="number" className={inputCls} style={inputStyle} value={editForm.electricityIndex} onChange={(e) => setEditForm({ ...editForm, electricityIndex: e.target.value })} />
                        </Field>
                        <Field label="Chỉ số nước (m³)">
                          <input type="number" className={inputCls} style={inputStyle} value={editForm.waterIndex} onChange={(e) => setEditForm({ ...editForm, waterIndex: e.target.value })} />
                        </Field>
                        <div className="md:col-span-2 flex gap-2"><Btn onClick={saveEdit}>Lưu</Btn><Btn variant="outline" onClick={cancelEdit}>Huỷ</Btn></div>
                      </div>
                    </td></tr>
                  );
                }
                return (
                  <tr key={r.id} style={{ background: i % 2 ? T.paper : "#fff" }}>
                    <td className="px-3 py-2 f-mono">{room ? roomLabel(room) : "—"}</td>
                    <td className="px-3 py-2 f-mono">{formatMonth(r.month)}</td>
                    <td className="px-3 py-2 f-mono">{r.electricityIndex}</td>
                    <td className="px-3 py-2 f-mono" style={{ color: T.amberDark }}>{r.elecUsage === null ? "—" : r.elecUsage}</td>
                    <td className="px-3 py-2 f-mono">{r.waterIndex}</td>
                    <td className="px-3 py-2 f-mono" style={{ color: T.amberDark }}>{r.waterUsage === null ? "—" : r.waterUsage}</td>
                    <td className="px-3 py-2 text-right">
                      {perm.canMaintain && (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => startEdit(r)} title="Sửa"><Pencil size={13} style={{ color: T.green }} /></button>
                          <button onClick={() => remove(r.id)} title="Xoá"><Trash2 size={13} style={{ color: T.red }} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ============ TAB: TÀI LIỆU - VĂN BẢN KÝ TÚC XÁ ============ */
function DocsTab({ user, perm }) {
  const { items, setItems, loading } = useSharedList("docs");
  const [form, setForm] = useState({ subject: "", title: "", url: "" });
  const [showForm, setShowForm] = useState(false);
  const [warn, setWarn] = useState("");

  const add = async () => {
    if (!form.title.trim()) { setWarn("Vui lòng nhập Tên tài liệu trước khi lưu."); return; }
    setWarn("");
    await setItems([{ id: Date.now(), ...form, by: user, date: new Date().toISOString() }, ...items]);
    setForm({ subject: "", title: "", url: "" });
    setShowForm(false);
  };
  const remove = async (id) => setItems(items.filter((i) => i.id !== id));
  const [selectedId, setSelectedId] = useState(null);
  const toggleSelect = (id) => setSelectedId((s) => (s === id ? null : id));

  const bySubject = items.reduce((acc, d) => {
    const k = d.subject || "Khác";
    (acc[k] = acc[k] || []).push(d);
    return acc;
  }, {});

  return (
    <div>
      <SectionHeader icon={FolderOpen} eyebrow="Kho lưu trữ" title="Tài liệu - Văn bản ký túc xá"
        action={perm.canManage && (
          <Btn onClick={() => setShowForm((s) => !s)}><Plus size={16} /> Thêm tài liệu</Btn>
        )} />

      {perm.canManage && showForm && (
        <div className="stamp-border p-4 mb-5 grid grid-cols-1 md:grid-cols-3 gap-3" style={{ background: "#fff" }}>
          <div className="md:col-span-3"><FormWarning message={warn} /></div>
          <Field label="Nhóm văn bản"><input className={inputCls} style={inputStyle} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="VD: Nội quy, Biểu mẫu…" /></Field>
          <Field label="Tên tài liệu" required><input className={inputCls} style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Đường dẫn (link)">
            <input className={inputCls} style={inputStyle} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            <UploadField onUploaded={(url) => setForm((f) => ({ ...f, url }))} />
          </Field>
          <div className="md:col-span-3"><Btn onClick={add}>Lưu</Btn></div>
        </div>
      )}

      {loading ? <LoadingRow /> : items.length === 0 ? <EmptyState text="Chưa có tài liệu nào." /> : (
        <div className="space-y-5">
          {Object.entries(bySubject).map(([subj, docs]) => (
            <div key={subj}>
              <div className="f-display text-sm uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: T.amberDark }}><ChevronRight size={14} />{subj}</div>
              <div className="space-y-2">
                {docs.map((d) => (
                  <div key={d.id} onClick={() => toggleSelect(d.id)} className="flex items-center justify-between p-3 cursor-pointer" style={withSelect({ background: "#fff" }, selectedId === d.id)}>
                    <div>
                      <div className="f-body text-sm font-medium" style={{ color: T.ink }}>{d.title}</div>
                      {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="f-mono text-xs underline break-all" style={{ color: T.green }}>{d.url}</a>}
                    </div>
                    {(perm.canManage || perm.isOwner(d.by)) && <button onClick={() => remove(d.id)}><Trash2 size={14} style={{ color: T.red }} /></button>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ SAO LƯU & KHÔI PHỤC ============ */
const ALL_DATA_KEYS = ["rooms", "students", "assets", "maintenance", "docs", "permissions", "authConfig", "managerInfo"];

function BackupSection() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const exportBackup = async () => {
    setBusy(true);
    setStatus("Đang gom dữ liệu…");
    try {
      const data = {};
      for (const k of ALL_DATA_KEYS) {
        try {
          const snap = await getDoc(doc(db, DATA_NS, k));
          data[k] = snap.exists() && snap.data().value ? JSON.parse(snap.data().value) : [];
        } catch (e) {
          data[k] = [];
        }
      }
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sao-luu-ktx-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus("Đã tải file sao lưu về máy.");
    } catch (e) {
      setStatus("Lỗi khi sao lưu, thử lại nhé.");
    } finally {
      setBusy(false);
    }
  };

  const restoreBackup = async (file) => {
    if (!file) return;
    setBusy(true);
    setStatus("Đang khôi phục dữ liệu…");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const data = parsed.data || parsed;
      let count = 0;
      for (const k of ALL_DATA_KEYS) {
        if (data[k] !== undefined) {
          await setDoc(doc(db, DATA_NS, k), { value: JSON.stringify(data[k]) });
          count++;
        }
      }
      setStatus(`Đã khôi phục ${count} mục dữ liệu.`);
    } catch (e) {
      setStatus("File không hợp lệ hoặc lỗi khi khôi phục.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stamp-border p-4 mb-5" style={{ background: "#fff" }}>
      <div className="f-display text-sm uppercase tracking-wider mb-2" style={{ color: T.amberDark }}>Sao lưu & khôi phục dữ liệu</div>
      <p className="f-body text-xs mb-3" style={{ color: T.inkSoft }}>
        Dữ liệu trang này đã được lưu trữ dùng chung trên Firebase, đồng bộ theo thời gian thực và không mất khi đăng xuất.
        Mục này chỉ để tải thêm một bản sao ra máy tính phòng trường hợp cần lưu trữ ngoài hoặc khôi phục lại.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Btn onClick={exportBackup} disabled={busy}><Paperclip size={16} /> Xuất file sao lưu (.json)</Btn>
        <label className="f-display text-sm tracking-wide uppercase px-4 py-2 flex items-center gap-2 cursor-pointer" style={{ background: "transparent", color: T.green, border: `1.5px solid ${T.green}` }}>
          <Plus size={16} /> Nhập file khôi phục
          <input type="file" accept="application/json" className="hidden" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) restoreBackup(f); }} />
        </label>
      </div>
      {status && <div className="f-body text-xs mt-3" style={{ color: T.inkSoft }}>{status}</div>}
    </div>
  );
}

/* ============ TAB: ĐỔI MẬT KHẨU ============ */
function PasswordTab({ user, perm }) {
  const { config, setConfig, loading } = useAuthConfig();
  const [unitPw, setUnitPw] = useState("");
  const [adminPw, setAdminPw] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [warn, setWarn] = useState("");

  useEffect(() => {
    setUnitPw(config.unitPassword);
    setAdminPw(config.adminPassword);
  }, [config.unitPassword, config.adminPassword]);

  const saveAdmin = async () => {
    if (!unitPw.trim() || !adminPw.trim()) { setWarn("Vui lòng nhập đủ cả Mật khẩu chung ký túc xá và Mật khẩu quản trị trước khi lưu."); return; }
    setWarn("");
    setSaving(true);
    const ok = await setConfig({ unitPassword: unitPw.trim(), adminPassword: adminPw.trim() });
    setSaving(false);
    setStatus(ok ? "Đã lưu mật khẩu mới. Áp dụng ngay từ lần đăng nhập tiếp theo." : "Lưu thất bại, thử lại nhé.");
    setTimeout(() => setStatus(""), 4000);
  };

  return (
    <div>
      <SectionHeader icon={KeyRound} eyebrow="Bảo mật" title="Đổi mật khẩu" />
      {loading ? <LoadingRow /> : (
        <div className="stamp-border p-4" style={{ background: "#fff" }}>
          <p className="f-body text-xs mb-4" style={{ color: T.inkSoft }}>
            Bạn là Quản trị — đổi được mật khẩu chung ký túc xá và mật khẩu quản trị. Mật khẩu mới áp dụng ngay từ lần
            đăng nhập tiếp theo của mọi người.
          </p>
          <FormWarning message={warn} />
          <Field label="Mật khẩu chung ký túc xá (dùng để đăng nhập thường)" required>
            <PasswordInput value={unitPw} onChange={(e) => setUnitPw(e.target.value)} />
          </Field>
          <Field label="Mật khẩu quản trị (đăng nhập được toàn quyền)" required>
            <PasswordInput value={adminPw} onChange={(e) => setAdminPw(e.target.value)} />
          </Field>
          <Btn onClick={saveAdmin} disabled={saving}>{saving ? "Đang lưu…" : "Lưu mật khẩu"}</Btn>
          {status && <div className="f-body text-xs mt-3" style={{ color: T.green }}>{status}</div>}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   TAB: QUẢN LÝ NỘI VỤ PHÒNG (chấm điểm vệ sinh, kiểm tra, vi phạm, xếp loại)
   ============================================================ */
function InspectionTab({ perm, user }) {
  const { items: inspections, setItems: setInspections, loading } = useSharedList("inspections");
  const { items: rooms } = useSharedList("rooms");
  const [showForm, setShowForm] = useState(false);
  const blank = { roomId: "", date: new Date().toISOString().slice(0, 10), hygieneScore: "10", violations: "", note: "" };
  const [form, setForm] = useState(blank);
  const [warn, setWarn] = useState("");
  const [filterBuilding, setFilterBuilding] = useState("");
  const [filterClass, setFilterClass] = useState("");

  const submit = async () => {
    if (!form.roomId) { setWarn("Vui lòng chọn phòng trước khi lưu."); return; }
    setWarn("");
    const classification = classifyRoomInspection(form.hygieneScore, Boolean(form.violations.trim()));
    await setInspections([
      { id: Date.now(), roomId: Number(form.roomId), date: form.date, hygieneScore: Number(form.hygieneScore) || 0, violations: form.violations, classification, note: form.note, inspector: user },
      ...inspections,
    ]);
    setForm(blank);
    setShowForm(false);
  };
  const remove = async (id) => setInspections(inspections.filter((x) => x.id !== id));

  const buildings = [...new Set(rooms.map((r) => r.building).filter(Boolean))];
  const filtered = inspections.filter((x) => {
    const room = rooms.find((r) => r.id === x.roomId);
    return (!filterBuilding || room?.building === filterBuilding) && (!filterClass || x.classification === filterClass);
  }).sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const classColor = { "Tốt": T.green, "Khá": T.amberDark, "Trung bình": T.amber, "Vi phạm": T.red };

  return (
    <div>
      <SectionHeader compact icon={ClipboardCheck} eyebrow={`Tổng số lượt kiểm tra: ${inspections.length}`} title="Quản lý nội vụ phòng"
        action={perm.canManage && (
          <Btn size="sm" onClick={() => (showForm ? setShowForm(false) : setShowForm(true))}><Plus size={14} /> Chấm điểm / Kiểm tra</Btn>
        )} />
      <p className="f-body text-xs mb-4" style={{ color: T.inkSoft }}>
        Ghi nhận kết quả kiểm tra vệ sinh nội vụ từng phòng, điểm số, vi phạm (nếu có) và tự động xếp loại phòng.
      </p>

      {perm.canManage && showForm && (
        <div className="stamp-border p-4 mb-5 grid grid-cols-1 md:grid-cols-3 gap-3" style={{ background: "#fff" }}>
          <div className="md:col-span-3"><FormWarning message={warn} /></div>
          <Field label="Phòng" required>
            <select className={inputCls} style={inputStyle} value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
              <option value="">— Chọn phòng —</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{roomLabel(r)}</option>)}
            </select>
          </Field>
          <Field label="Ngày kiểm tra" required>
            <input type="date" className={inputCls} style={inputStyle} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Điểm vệ sinh (0-10)" required>
            <input type="number" min="0" max="10" className={inputCls} style={inputStyle} value={form.hygieneScore} onChange={(e) => setForm({ ...form, hygieneScore: e.target.value })} />
          </Field>
          <div className="md:col-span-3">
            <Field label="Vi phạm (nếu có, để trống nếu không vi phạm)">
              <input className={inputCls} style={inputStyle} value={form.violations} onChange={(e) => setForm({ ...form, violations: e.target.value })} placeholder="VD: Để đồ đạc bừa bãi, hút thuốc trong phòng…" />
            </Field>
          </div>
          <div className="md:col-span-3">
            <Field label="Ghi chú"><input className={inputCls} style={inputStyle} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          </div>
          <div className="md:col-span-3 f-body text-xs" style={{ color: T.inkSoft }}>
            Xếp loại dự kiến: <b style={{ color: classColor[classifyRoomInspection(form.hygieneScore, Boolean(form.violations.trim()))] }}>
              {classifyRoomInspection(form.hygieneScore, Boolean(form.violations.trim()))}
            </b>
          </div>
          <div className="md:col-span-3"><Btn onClick={submit}>Lưu kết quả kiểm tra</Btn></div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <select className={inputCls} style={{ ...inputStyle, width: "auto" }} value={filterBuilding} onChange={(e) => setFilterBuilding(e.target.value)}>
          <option value="">— Tất cả toà nhà —</option>
          {buildings.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className={inputCls} style={{ ...inputStyle, width: "auto" }} value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
          <option value="">— Tất cả xếp loại —</option>
          {INSPECTION_CLASS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? <LoadingRow /> : filtered.length === 0 ? <EmptyState text="Chưa có lượt kiểm tra nào phù hợp." /> : (
        <div className="overflow-x-auto stamp-border card-sheet" style={{ background: "#fff" }}>
          <table className="w-full text-sm f-body table-lines">
            <thead>
              <tr className="f-mono text-[11px] uppercase tracking-wider" style={{ background: T.green, color: T.paper }}>
                <th className="text-left px-3 py-2">Phòng</th>
                <th className="text-left px-3 py-2">Ngày</th>
                <th className="text-left px-3 py-2">Điểm</th>
                <th className="text-left px-3 py-2">Vi phạm</th>
                <th className="text-left px-3 py-2">Xếp loại</th>
                <th className="text-left px-3 py-2">Người kiểm tra</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((x, i) => {
                const room = rooms.find((r) => r.id === x.roomId);
                return (
                  <tr key={x.id} style={{ background: i % 2 ? T.paper : "#fff" }}>
                    <td className="px-3 py-2 f-mono">{room ? roomLabel(room) : "—"}</td>
                    <td className="px-3 py-2 f-mono">{formatDob(x.date)}</td>
                    <td className="px-3 py-2 f-mono">{x.hygieneScore}</td>
                    <td className="px-3 py-2" style={{ color: T.inkSoft }}>{x.violations || "—"}</td>
                    <td className="px-3 py-2">
                      <span className="f-mono text-[10px] uppercase px-1.5 py-0.5 rounded-sm" style={{ background: classColor[x.classification] || T.green, color: "#fff" }}>{x.classification}</span>
                    </td>
                    <td className="px-3 py-2">{x.inspector}</td>
                    <td className="px-3 py-2 text-right">
                      {perm.canManage && <button onClick={() => remove(x.id)} title="Xoá"><Trash2 size={13} style={{ color: T.red }} /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   TAB: THÔNG BÁO (toàn KTX / theo tòa nhà / tầng / phòng / khoá học)
   ============================================================ */
function NotificationsTab({ perm, user }) {
  const { items: notifications, setItems: setNotifications, loading } = useSharedList("notifications");
  const { items: rooms } = useSharedList("rooms");
  const { items: students } = useSharedList("students");
  const [showForm, setShowForm] = useState(false);
  const blank = { scope: "toan_ktx", scopeValue: "", title: "", content: "", attachments: [] };
  const [form, setForm] = useState(blank);
  const [warn, setWarn] = useState("");

  const buildings = [...new Set(rooms.map((r) => r.building).filter(Boolean))];
  const areas = [...new Set(rooms.map((r) => r.area).filter(Boolean))];
  const khoaList = [...new Set(students.map((s) => s.khoa).filter(Boolean))];

  const submit = async () => {
    if (!form.title.trim()) { setWarn("Vui lòng nhập tiêu đề thông báo."); return; }
    if (form.scope !== "toan_ktx" && !String(form.scopeValue).trim()) { setWarn("Vui lòng chọn đối tượng nhận thông báo cụ thể."); return; }
    setWarn("");
    await setNotifications([
      { id: Date.now(), scope: form.scope, scopeValue: form.scopeValue, title: form.title, content: form.content, attachments: form.attachments, createdAt: new Date().toISOString(), by: user },
      ...notifications,
    ]);
    setForm(blank);
    setShowForm(false);
  };
  const remove = async (id) => setNotifications(notifications.filter((n) => n.id !== id));
  const removeAttachment = (idx) => setForm((f) => ({ ...f, attachments: f.attachments.filter((_, i) => i !== idx) }));

  // ===== Sửa thông báo (chỉ Quản trị / cán bộ) =====
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editWarn, setEditWarn] = useState("");
  const startEdit = (n) => {
    setShowForm(false);
    setEditingId(n.id);
    setEditForm({ scope: n.scope, scopeValue: n.scopeValue ?? "", title: n.title, content: n.content || "", attachments: n.attachments || [] });
    setEditWarn("");
  };
  const cancelEdit = () => { setEditingId(null); setEditForm(null); setEditWarn(""); };
  const removeEditAttachment = (idx) => setEditForm((f) => ({ ...f, attachments: f.attachments.filter((_, i) => i !== idx) }));
  const saveEdit = async () => {
    if (!editForm.title.trim()) { setEditWarn("Vui lòng nhập tiêu đề thông báo."); return; }
    if (editForm.scope !== "toan_ktx" && !String(editForm.scopeValue).trim()) { setEditWarn("Vui lòng chọn đối tượng nhận thông báo cụ thể."); return; }
    await setNotifications(notifications.map((n) => (n.id === editingId
      ? { ...n, scope: editForm.scope, scopeValue: editForm.scopeValue, title: editForm.title, content: editForm.content, attachments: editForm.attachments, editedBy: user, editedAt: new Date().toISOString() }
      : n)));
    cancelEdit();
  };

  const scopeLabel = (n) => {
    const def = NOTIFICATION_SCOPES.find((s) => s.key === n.scope);
    if (n.scope === "toan_ktx") return def?.label || "Toàn ký túc xá";
    if (n.scope === "phong") { const room = rooms.find((r) => r.id === Number(n.scopeValue)); return `${def?.label} · ${room ? roomLabel(room) : n.scopeValue}`; }
    return `${def?.label} · ${n.scopeValue}`;
  };

  // Xác định hồ sơ sinh viên khớp với người đang đăng nhập (so tên, không phân biệt hoa/thường, khoảng trắng)
  // để biết phòng/tòa nhà/tầng/khoá của họ — dùng cho việc lọc "nơi nào chỉ nơi đó thấy".
  const myStudent = students.find((s) => perm.isOwner(s.name));
  const myRoom = myStudent ? rooms.find((r) => r.id === myStudent.roomId) : null;

  const matchesScope = (n) => {
    if (n.scope === "toan_ktx") return true;
    if (!myStudent) return false; // Không xác định được hồ sơ của người dùng thì không hiện thông báo thu hẹp phạm vi
    if (n.scope === "toa_nha") return myRoom && String(myRoom.building) === String(n.scopeValue);
    if (n.scope === "tang") return myRoom && String(myRoom.area) === String(n.scopeValue);
    if (n.scope === "phong") return myStudent.roomId != null && String(myStudent.roomId) === String(n.scopeValue);
    if (n.scope === "khoa") return String(myStudent.khoa || "") === String(n.scopeValue);
    return true;
  };

  // Quản trị / cán bộ (canManage) xem toàn bộ thông báo để theo dõi & quản lý.
  // Các vai trò khác chỉ thấy thông báo "Toàn ký túc xá" hoặc đúng phòng/tòa nhà/tầng/khoá của mình.
  const visible = perm.canManage ? notifications : notifications.filter(matchesScope);
  const sorted = [...visible].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  return (
    <div>
      <SectionHeader compact icon={Bell} eyebrow={`Tổng số thông báo: ${notifications.length}`} title="Thông báo"
        action={perm.canManage && (
          <Btn size="sm" onClick={() => (showForm ? setShowForm(false) : setShowForm(true))}><Plus size={14} /> Gửi thông báo</Btn>
        )} />
      <p className="f-body text-xs mb-4" style={{ color: T.inkSoft }}>
        Gửi thông báo tới toàn ký túc xá, hoặc thu hẹp theo tòa nhà, tầng/khu vực, phòng cụ thể, hoặc theo khoá học.
        {!perm.canManage && !myStudent && (
          <span> — Tên đăng nhập của bạn chưa khớp với hồ sơ Sinh viên nội trú nên chỉ hiện được thông báo "Toàn ký túc xá"; đăng nhập đúng họ tên trong danh sách sinh viên để xem đủ thông báo theo phòng/tòa nhà/khoá của bạn.</span>
        )}
      </p>

      {perm.canManage && showForm && (
        <div className="stamp-border p-4 mb-5 grid grid-cols-1 md:grid-cols-2 gap-3" style={{ background: "#fff" }}>
          <div className="md:col-span-2"><FormWarning message={warn} /></div>
          <Field label="Phạm vi gửi" required>
            <select className={inputCls} style={inputStyle} value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value, scopeValue: "" })}>
              {NOTIFICATION_SCOPES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Field>
          {form.scope === "toa_nha" && (
            <Field label="Chọn tòa nhà" required>
              <select className={inputCls} style={inputStyle} value={form.scopeValue} onChange={(e) => setForm({ ...form, scopeValue: e.target.value })}>
                <option value="">— Chọn —</option>
                {buildings.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
          )}
          {form.scope === "tang" && (
            <Field label="Chọn tầng / khu vực" required>
              <select className={inputCls} style={inputStyle} value={form.scopeValue} onChange={(e) => setForm({ ...form, scopeValue: e.target.value })}>
                <option value="">— Chọn —</option>
                {areas.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
          )}
          {form.scope === "phong" && (
            <Field label="Chọn phòng" required>
              <select className={inputCls} style={inputStyle} value={form.scopeValue} onChange={(e) => setForm({ ...form, scopeValue: e.target.value })}>
                <option value="">— Chọn —</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{roomLabel(r)}</option>)}
              </select>
            </Field>
          )}
          {form.scope === "khoa" && (
            <Field label="Chọn khoá học" required>
              <select className={inputCls} style={inputStyle} value={form.scopeValue} onChange={(e) => setForm({ ...form, scopeValue: e.target.value })}>
                <option value="">— Chọn —</option>
                {khoaList.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </Field>
          )}
          <div className="md:col-span-2">
            <Field label="Tiêu đề" required><input className={inputCls} style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Nội dung"><textarea rows={3} className={inputCls} style={inputStyle} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Hình ảnh / tệp đính kèm">
              <UploadField multiple onUploaded={(url, name, type) => setForm((f) => ({ ...f, attachments: [...(f.attachments || []), { url, name, type }] }))} />
              {form.attachments?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.attachments.map((a, idx) => (
                    <div key={idx} className="relative flex items-center gap-1.5 pl-1.5 pr-1.5 py-1" style={{ border: `1px solid ${T.paperDark}`, background: T.paper }}>
                      {isImageAttachment(a) ? (
                        <a href={a.url} target="_blank" rel="noreferrer" title="Xem ảnh">
                          <img src={a.url} alt={a.name || "Đính kèm"} className="w-10 h-10 object-cover stamp-border" />
                        </a>
                      ) : (
                        <span className="w-10 h-10 flex items-center justify-center" style={{ color: T.green }}><Paperclip size={16} /></span>
                      )}
                      <span className="f-mono text-[10px] max-w-[100px] truncate" style={{ color: T.inkSoft }}>{a.name || "Tệp đính kèm"}</span>
                      <button type="button" onClick={() => downloadFileFromUrl(a.url, a.name || `dinh-kem-${idx + 1}`)} title="Tải về">
                        <Upload size={13} style={{ color: T.green, transform: "rotate(180deg)" }} />
                      </button>
                      <button type="button" onClick={() => removeAttachment(idx)} title="Xoá đính kèm">
                        <X size={13} style={{ color: T.red }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Field>
          </div>
          <div className="md:col-span-2"><Btn onClick={submit}>Gửi thông báo</Btn></div>
        </div>
      )}

      {loading ? <LoadingRow /> : sorted.length === 0 ? <EmptyState text="Chưa có thông báo nào." /> : (
        <div className="space-y-3">
          {sorted.map((n) => {
            if (perm.canManage && editingId === n.id) {
              return (
                <div key={n.id} className="stamp-border p-4 grid grid-cols-1 md:grid-cols-2 gap-3" style={{ background: "#fff" }}>
                  <div className="md:col-span-2"><FormWarning message={editWarn} /></div>
                  <Field label="Phạm vi gửi" required>
                    <select className={inputCls} style={inputStyle} value={editForm.scope} onChange={(e) => setEditForm({ ...editForm, scope: e.target.value, scopeValue: "" })}>
                      {NOTIFICATION_SCOPES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </Field>
                  {editForm.scope === "toa_nha" && (
                    <Field label="Chọn tòa nhà" required>
                      <select className={inputCls} style={inputStyle} value={editForm.scopeValue} onChange={(e) => setEditForm({ ...editForm, scopeValue: e.target.value })}>
                        <option value="">— Chọn —</option>
                        {buildings.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </Field>
                  )}
                  {editForm.scope === "tang" && (
                    <Field label="Chọn tầng / khu vực" required>
                      <select className={inputCls} style={inputStyle} value={editForm.scopeValue} onChange={(e) => setEditForm({ ...editForm, scopeValue: e.target.value })}>
                        <option value="">— Chọn —</option>
                        {areas.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </Field>
                  )}
                  {editForm.scope === "phong" && (
                    <Field label="Chọn phòng" required>
                      <select className={inputCls} style={inputStyle} value={editForm.scopeValue} onChange={(e) => setEditForm({ ...editForm, scopeValue: e.target.value })}>
                        <option value="">— Chọn —</option>
                        {rooms.map((r) => <option key={r.id} value={r.id}>{roomLabel(r)}</option>)}
                      </select>
                    </Field>
                  )}
                  {editForm.scope === "khoa" && (
                    <Field label="Chọn khoá học" required>
                      <select className={inputCls} style={inputStyle} value={editForm.scopeValue} onChange={(e) => setEditForm({ ...editForm, scopeValue: e.target.value })}>
                        <option value="">— Chọn —</option>
                        {khoaList.map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </Field>
                  )}
                  <div className="md:col-span-2">
                    <Field label="Tiêu đề" required><input className={inputCls} style={inputStyle} value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} /></Field>
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Nội dung"><textarea rows={3} className={inputCls} style={inputStyle} value={editForm.content} onChange={(e) => setEditForm({ ...editForm, content: e.target.value })} /></Field>
                  </div>
                  <div className="md:col-span-2">
                    <Field label="Hình ảnh / tệp đính kèm">
                      <UploadField multiple onUploaded={(url, name, type) => setEditForm((f) => ({ ...f, attachments: [...(f.attachments || []), { url, name, type }] }))} />
                      {editForm.attachments?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {editForm.attachments.map((a, idx) => (
                            <div key={idx} className="relative flex items-center gap-1.5 pl-1.5 pr-1.5 py-1" style={{ border: `1px solid ${T.paperDark}`, background: T.paper }}>
                              {isImageAttachment(a) ? (
                                <a href={a.url} target="_blank" rel="noreferrer" title="Xem ảnh">
                                  <img src={a.url} alt={a.name || "Đính kèm"} className="w-10 h-10 object-cover stamp-border" />
                                </a>
                              ) : (
                                <span className="w-10 h-10 flex items-center justify-center" style={{ color: T.green }}><Paperclip size={16} /></span>
                              )}
                              <span className="f-mono text-[10px] max-w-[100px] truncate" style={{ color: T.inkSoft }}>{a.name || "Tệp đính kèm"}</span>
                              <button type="button" onClick={() => downloadFileFromUrl(a.url, a.name || `dinh-kem-${idx + 1}`)} title="Tải về">
                                <Upload size={13} style={{ color: T.green, transform: "rotate(180deg)" }} />
                              </button>
                              <button type="button" onClick={() => removeEditAttachment(idx)} title="Xoá đính kèm">
                                <X size={13} style={{ color: T.red }} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </Field>
                  </div>
                  <div className="md:col-span-2 flex gap-2"><Btn onClick={saveEdit}>Lưu</Btn><Btn variant="outline" onClick={cancelEdit}>Huỷ</Btn></div>
                </div>
              );
            }
            return (
            <div key={n.id} className="stamp-border p-3" style={{ background: "#fff" }}>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="f-body text-sm font-semibold" style={{ color: T.ink }}>{n.title}</div>
                  <div className="f-mono text-[10.5px]" style={{ color: T.inkSoft }}>
                    {scopeLabel(n)} · {formatDateTime(n.createdAt)} · {n.by}
                    {n.editedAt && <span className="italic"> · đã sửa {formatDateTime(n.editedAt)}</span>}
                  </div>
                </div>
                {perm.canManage && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => startEdit(n)} title="Sửa"><Pencil size={13} style={{ color: T.green }} /></button>
                    <button onClick={() => remove(n.id)} title="Xoá"><Trash2 size={13} style={{ color: T.red }} /></button>
                  </div>
                )}
              </div>
              {n.content && <div className="f-body text-xs mt-2" style={{ color: T.ink }}>{n.content}</div>}
              {n.attachments?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {n.attachments.map((a, idx) => (
                    isImageAttachment(a) ? (
                      <div key={idx} className="relative group">
                        <a href={a.url} target="_blank" rel="noreferrer" title={a.name || "Xem ảnh"}>
                          <img src={a.url} alt={a.name || `Hình ảnh ${idx + 1}`} className="w-20 h-20 object-cover stamp-border" />
                        </a>
                        <button
                          type="button"
                          onClick={() => downloadFileFromUrl(a.url, a.name || `hinh-anh-${idx + 1}.jpg`)}
                          title="Tải ảnh về máy"
                          className="absolute bottom-1 right-1 flex items-center gap-1 px-1.5 py-0.5 rounded-sm f-mono text-[9.5px] btn-press"
                          style={{ background: "rgba(31,51,40,0.85)", color: "#fff", border: "none" }}
                        >
                          <Upload size={10} style={{ transform: "rotate(180deg)" }} /> Tải về
                        </button>
                      </div>
                    ) : (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => downloadFileFromUrl(a.url, a.name || `tep-dinh-kem-${idx + 1}`)}
                        title="Tải tệp về máy"
                        className="flex items-center gap-1.5 px-2.5 py-2 btn-press"
                        style={{ border: `1px solid ${T.paperDark}`, background: T.paper }}
                      >
                        <Paperclip size={13} style={{ color: T.green }} />
                        <span className="f-mono text-[10.5px] max-w-[150px] truncate" style={{ color: T.ink }}>{a.name || "Tệp đính kèm"}</span>
                        <Upload size={11} style={{ color: T.inkSoft, transform: "rotate(180deg)" }} />
                      </button>
                    )
                  ))}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   TAB: BÁO CÁO - THỐNG KÊ (danh sách, tỷ lệ sử dụng, xuất Excel)
   ============================================================ */
async function exportSheetsToExcel(filename, sheets) {
  const XLSX = await loadXLSXLib();
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "Không có dữ liệu": "" }]);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });
  XLSX.writeFile(wb, filename);
}

function ReportsTab({ perm }) {
  const { items: rooms, loading: roomsLoading } = useSharedList("rooms");
  const { items: students, loading: studentsLoading } = useSharedList("students");
  const { items: assets, loading: assetsLoading } = useSharedList("assets");
  const { items: maint, loading: maintLoading } = useSharedList("maintenance");
  const [exporting, setExporting] = useState(false);

  const loading = roomsLoading || studentsLoading || assetsLoading || maintLoading;
  const activeStudents = students.filter((s) => s.status !== "Đã trả phòng");
  const totalCapacity = rooms.reduce((s, r) => s + (Number(r.capacity) || 0), 0);
  const occupied = activeStudents.filter((s) => s.roomId).length;
  const usageRate = totalCapacity > 0 ? Math.round((occupied / totalCapacity) * 1000) / 10 : 0;

  const assetByStatus = ASSET_STATUS.reduce((acc, s) => { acc[s] = assets.filter((a) => a.status === s).length; return acc; }, {});
  const maintByStatus = MAINT_STATUS.reduce((acc, s) => { acc[s] = maint.filter((m) => m.status === s).length; return acc; }, {});

  const doExport = async () => {
    setExporting(true);
    try {
      const studentRows = activeStudents.map((s) => {
        const room = rooms.find((r) => r.id === s.roomId);
        return { "MSV": s.msv, "Họ tên": s.name, "Giới tính": s.gender, "Khoá": s.khoa, "Lớp": s.lop, "Phòng": room ? roomLabel(room) : "Chưa xếp phòng", "Trạng thái": s.status || "Đang ở" };
      });
      const roomRows = rooms.map((r) => ({ "Toà nhà": r.building, "Tầng/Khu vực": r.area, "Số phòng": r.roomNumber, "Sức chứa": r.capacity, "Trạng thái": effectiveRoomStatus(r, activeStudents.filter((s) => s.roomId === r.id).length), "SL đang ở": activeStudents.filter((s) => s.roomId === r.id).length }));
      const assetRows = assets.map((a) => { const room = rooms.find((r) => r.id === a.roomId); return { "Phòng": room ? roomLabel(room) : "—", "Tên tài sản": a.name, "Phân loại": a.category, "Số lượng": a.quantity, "Tình trạng": a.status, "Ghi chú": a.note }; });
      const maintRows = maint.map((m) => { const room = rooms.find((r) => r.id === m.roomId); return { "Phòng": room ? roomLabel(room) : "—", "Nội dung": m.title, "Người gửi": m.reporterName, "Trạng thái": m.status, "Ngày gửi": formatDateTime(m.createdAt) }; });
      await exportSheetsToExcel(`BaoCaoKyTucXa_${new Date().toISOString().slice(0, 10)}.xlsx`, [
        { name: "Học viên nội trú", rows: studentRows },
        { name: "Danh sách phòng", rows: roomRows },
        { name: "Tài sản", rows: assetRows },
        { name: "Bảo trì", rows: maintRows },
      ]);
    } catch (e) {
      reportGlobalError(`Xuất Excel thất bại — ${e?.message || e}`);
    }
    setExporting(false);
  };

  return (
    <div>
      <SectionHeader icon={ClipboardCheck} eyebrow="Chỉ quản trị / cán bộ" title="Báo cáo - Thống kê"
        action={<Btn size="sm" onClick={doExport} disabled={exporting || loading}>{exporting ? "Đang xuất…" : "Xuất Excel"}</Btn>} />

      {loading ? <LoadingRow /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="stamp-border p-4" style={{ background: "#fff" }}>
              <div className="f-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: T.inkSoft }}>Học viên nội trú</div>
              <div className="f-display text-2xl font-semibold" style={{ color: T.green }}>{activeStudents.length}</div>
            </div>
            <div className="stamp-border p-4" style={{ background: "#fff" }}>
              <div className="f-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: T.inkSoft }}>Tổng số phòng</div>
              <div className="f-display text-2xl font-semibold" style={{ color: T.green }}>{rooms.length}</div>
            </div>
            <div className="stamp-border p-4" style={{ background: "#fff" }}>
              <div className="f-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: T.inkSoft }}>Tỷ lệ sử dụng phòng</div>
              <div className="f-display text-2xl font-semibold" style={{ color: T.amberDark }}>{usageRate}%</div>
            </div>
            <div className="stamp-border p-4" style={{ background: "#fff" }}>
              <div className="f-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: T.inkSoft }}>Yêu cầu sửa chữa</div>
              <div className="f-display text-2xl font-semibold" style={{ color: T.red }}>{maint.length}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="stamp-border p-4" style={{ background: "#fff" }}>
              <div className="f-display text-sm uppercase tracking-wider mb-3" style={{ color: T.amberDark }}>Báo cáo tài sản (theo tình trạng)</div>
              {ASSET_STATUS.map((s) => (
                <div key={s} className="flex items-center justify-between f-body text-sm mb-1">
                  <span style={{ color: T.ink }}>{s}</span>
                  <span className="f-mono font-semibold" style={{ color: s === "Hỏng" ? T.red : T.green }}>{assetByStatus[s] || 0}</span>
                </div>
              ))}
              <div className="flex items-center justify-between f-body text-sm pt-1" style={{ borderTop: `1px dashed ${T.paperDark}` }}>
                <span style={{ color: T.inkSoft }}>Tổng số tài sản</span>
                <span className="f-mono font-semibold" style={{ color: T.green }}>{assets.length}</span>
              </div>
            </div>
            <div className="stamp-border p-4" style={{ background: "#fff" }}>
              <div className="f-display text-sm uppercase tracking-wider mb-3" style={{ color: T.amberDark }}>Báo cáo sửa chữa (theo trạng thái)</div>
              {MAINT_STATUS.map((s) => (
                <div key={s} className="flex items-center justify-between f-body text-sm mb-1">
                  <span style={{ color: T.ink }}>{s}</span>
                  <span className="f-mono font-semibold" style={{ color: s === "Chờ xử lý" ? T.red : T.green }}>{maintByStatus[s] || 0}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="f-body text-xs mt-4 italic" style={{ color: T.inkSoft }}>
            Bấm "Xuất Excel" để tải về báo cáo đầy đủ gồm danh sách học viên nội trú, danh sách phòng, tài sản và bảo trì (nhiều sheet trong 1 file).
          </p>
        </>
      )}
    </div>
  );
}

/* ============ TAB: PHÂN QUYỀN ============ */
function PermissionsTab({ permissions, setPermissions, permLoading }) {
  const { items: students } = useSharedList("students");
  const [nameInput, setNameInput] = useState("");
  const [roleInput, setRoleInput] = useState("can_bo");
  const [warn, setWarn] = useState("");

  const grant = async () => {
    const nm = nameInput.trim();
    if (!nm) { setWarn("Vui lòng nhập Họ và tên trước khi gán quyền."); return; }
    setWarn("");
    const rest = permissions.filter((p) => normalizeName(p.name) !== normalizeName(nm));
    await setPermissions([...rest, { id: Date.now(), name: nm, role: roleInput }]);
    setNameInput("");
  };
  const revoke = async (id) => setPermissions(permissions.filter((p) => p.id !== id));
  const [selectedId, setSelectedId] = useState(null);
  const toggleSelect = (id) => setSelectedId((s) => (s === id ? null : id));

  const roleLabel = { can_bo: "Cán bộ quản lý ký túc xá (toàn quyền thêm/sửa/xoá)", ky_thuat: "Kỹ thuật (quản lý Tài sản & Bảo trì)", sinh_vien: "Học viên (chỉ gửi yêu cầu, tự xoá yêu cầu của mình)" };

  return (
    <div>
      <SectionHeader icon={Shield} eyebrow="Chỉ quản trị" title="Phân quyền người dùng" />

      <BackupSection />

      <div className="stamp-border p-4 mb-5" style={{ background: "#fff" }}>
        <p className="f-body text-xs mb-3" style={{ color: T.inkSoft }}>
          Mặc định, chỉ <b>Quản trị viên</b> và <b>Cán bộ quản lý ký túc xá</b> mới được thêm/xoá/sửa Phòng, Học viên, Bố trí và Phân quyền.
          Vai trò <b>Kỹ thuật</b> chỉ được quản lý mục Tài sản - thiết bị và Bảo trì (cập nhật trạng thái, ghi chú xử lý).
          Học viên chỉ gửi được yêu cầu bảo trì và tự xoá yêu cầu do chính mình gửi. Nhập đúng họ tên người đó dùng để đăng nhập, rồi chọn vai trò.
        </p>
        <FormWarning message={warn} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <Field label="Họ và tên" required>
            <input list="student-names" className={inputCls} style={inputStyle} value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="VD: Nguyễn Văn A" />
            <datalist id="student-names">
              {students.map((m) => <option key={m.id} value={m.name} />)}
            </datalist>
          </Field>
          <Field label="Vai trò">
            <select className={inputCls} style={inputStyle} value={roleInput} onChange={(e) => setRoleInput(e.target.value)}>
              <option value="can_bo">Cán bộ quản lý ký túc xá</option>
              <option value="ky_thuat">Kỹ thuật</option>
              <option value="sinh_vien">Học viên</option>
            </select>
          </Field>
          <div><Btn onClick={grant}>Gán quyền</Btn></div>
        </div>
      </div>

      {permLoading ? <LoadingRow /> : permissions.length === 0 ? (
        <EmptyState text="Chưa gán quyền cho ai — mọi người hiện đều là Sinh viên mặc định." />
      ) : (
        <div className="overflow-x-auto stamp-border" style={{ background: "#fff" }}>
          <table className="w-full text-sm f-body table-lines">
            <thead>
              <tr className="f-mono text-[11px] uppercase tracking-wider" style={{ background: T.green, color: T.paper }}>
                <th className="text-left px-3 py-2">Họ tên</th><th className="text-left px-3 py-2">Vai trò</th><th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((p, i) => (
                <tr key={p.id} onClick={() => toggleSelect(p.id)} className="cursor-pointer" style={withSelect({ background: i % 2 ? T.paper : "#fff" }, selectedId === p.id)}>
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2">{roleLabel[p.role] || p.role}</td>
                  <td className="px-3 py-2 text-right"><button onClick={() => revoke(p.id)} title="Gỡ quyền (về Sinh viên mặc định)"><Trash2 size={14} style={{ color: T.red }} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ============ MAIN APP ============ */
const TABS = [
  { id: "home", label: "Tổng quan", icon: LayoutGrid },
  { id: "rooms", label: "Danh sách phòng", icon: Building2 },
  { id: "students", label: "Sinh viên nội trú", icon: Users },
  { id: "assignment", label: "Bố trí sinh viên", icon: ArrowRightLeft },
  { id: "roster", label: "Quản lý quân số", icon: Users },
  { id: "assets", label: "Tài sản & thiết bị", icon: Boxes },
  { id: "maintenance", label: "Quản lý bảo trì", icon: Wrench },
  { id: "utilities", label: "Điện - Nước", icon: Zap },
  { id: "inspections", label: "Nội vụ phòng", icon: ClipboardCheck },
  { id: "notifications", label: "Thông báo", icon: Bell },
  { id: "docs", label: "Tài liệu - Văn bản", icon: FolderOpen },
];

// Mỗi mục chỉ hiện với đúng những vai trò được liệt kê ở đây — Học viên (sinh_vien) chỉ thấy
// những mục dành cho mình (Tổng quan, Danh sách phòng để xem, Quản lý bảo trì để gửi/theo dõi yêu cầu,
// Thông báo, Tài liệu - Văn bản). Các mục quản lý (danh sách sinh viên có thông tin cá nhân, bố trí phòng,
// quân số, tài sản, điện - nước, nội vụ phòng) không hiện ra với Học viên, không chỉ là bị khoá nút bấm.
const TAB_ROLES = {
  home: ["admin", "can_bo", "ky_thuat", "sinh_vien"],
  rooms: ["admin", "can_bo", "ky_thuat", "sinh_vien"],
  students: ["admin", "can_bo"],
  assignment: ["admin", "can_bo"],
  roster: ["admin", "can_bo"],
  assets: ["admin", "can_bo", "ky_thuat"],
  maintenance: ["admin", "can_bo", "ky_thuat", "sinh_vien"],
  utilities: ["admin", "can_bo", "ky_thuat"],
  inspections: ["admin", "can_bo"],
  notifications: ["admin", "can_bo", "ky_thuat", "sinh_vien"],
  docs: ["admin", "can_bo", "ky_thuat", "sinh_vien"],
};

export default function App() {
  const [user, setUser] = useState(null);
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [tab, setTab] = useState("home");
  const [navOpen, setNavOpen] = useState(false);
  const { value: managerInfo, setValue: setManagerInfo } = useSingleDoc("managerInfo", { name: "", phone: "" });
  const [editingManager, setEditingManager] = useState(false);
  const [managerForm, setManagerForm] = useState({ name: "", phone: "" });

  const { perm, permissions, setPermissions, permLoading } = useRole(user, isAdminLogin);

  // Phòng trường hợp đang đứng ở một mục mà vai trò hiện tại không còn quyền xem (VD: quản trị vừa
  // đổi quyền của mình, hoặc Học viên lỡ đứng ở mục không dành cho mình), tự động đưa về Tổng quan.
  // Đặt TRƯỚC "if (!user) return" để không vi phạm Rules of Hooks (số lượng hook phải giống nhau mỗi lần render).
  useEffect(() => {
    if (!user) return;
    const allowed = tab === "reports" ? perm.canManage
      : (tab === "password" || tab === "permissions") ? perm.isAdmin
      : (TAB_ROLES[tab] || []).includes(perm.role);
    if (!allowed) setTab("home");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perm.role, user]);

  if (!user) return <LoginGate onLogin={(name, admin) => { setUser(name); setIsAdminLogin(!!admin); }} />;

  const roleBadge = { admin: "Quản trị", can_bo: "Cán bộ quản lý", ky_thuat: "Kỹ thuật", sinh_vien: "Học viên" };
  const canEditManager = perm.canManage;
  const startEditManager = () => { setManagerForm({ name: managerInfo.name || "", phone: managerInfo.phone || "" }); setEditingManager(true); };
  const cancelEditManager = () => setEditingManager(false);
  const saveManager = async () => { await setManagerInfo({ name: managerForm.name.trim(), phone: managerForm.phone.trim() }); setEditingManager(false); };

  const goToTab = (tabId) => { setTab(tabId); setNavOpen(false); };

  const renderTab = () => {
    const isReportsOrAdminTab = tab === "reports" || tab === "password" || tab === "permissions";
    const allowedForTab = isReportsOrAdminTab
      ? (tab === "reports" ? perm.canManage : perm.isAdmin)
      : (TAB_ROLES[tab] || []).includes(perm.role);
    if (!allowedForTab) return <DashboardTab perm={perm} onNavigate={goToTab} />;
    switch (tab) {
      case "home": return <DashboardTab perm={perm} onNavigate={goToTab} />;
      case "rooms": return <RoomsTab perm={perm} />;
      case "students": return <StudentsTab perm={perm} user={user} />;
      case "assignment": return <AssignmentTab perm={perm} />;
      case "roster": return <RosterTab perm={perm} />;
      case "assets": return <AssetsTab perm={perm} user={user} />;
      case "maintenance": return <MaintenanceTab perm={perm} user={user} />;
      case "utilities": return <UtilitiesTab perm={perm} user={user} />;
      case "inspections": return <InspectionTab perm={perm} user={user} />;
      case "notifications": return <NotificationsTab perm={perm} user={user} />;
      case "reports": return <ReportsTab perm={perm} />;
      case "docs": return <DocsTab user={user} perm={perm} />;
      case "permissions": return <PermissionsTab permissions={permissions} setPermissions={setPermissions} permLoading={permLoading} />;
      case "password": return <PasswordTab user={user} perm={perm} />;
      default: return null;
    }
  };

  const visibleTabs = [
    ...TABS.filter((t) => (TAB_ROLES[t.id] || []).includes(perm.role)),
    ...(perm.canManage ? [{ id: "reports", label: "Báo cáo - Thống kê", icon: ClipboardCheck }] : []),
    ...(perm.isAdmin ? [{ id: "password", label: "Đổi mật khẩu", icon: KeyRound }] : []),
    ...(perm.isAdmin ? [{ id: "permissions", label: "Phân quyền", icon: Shield }] : []),
  ];
  const roleIcon = { admin: Star, can_bo: Shield, ky_thuat: Wrench, sinh_vien: Users };
  const RoleIcon = roleIcon[perm.role] || Users;

  return (
    <div className="min-h-screen paper-tex f-body" style={{ color: T.ink }}>
      <style>{FONT_STYLE}</style>
      <ErrorBanner />

      <header
        className="flex items-center justify-between px-4 md:px-6 py-3 relative z-30"
        style={{ background: `linear-gradient(180deg, ${T.green}, ${T.greenDark})`, borderBottom: `2px solid ${T.gold}` }}
      >
        <div className="flex items-center gap-3">
          <button className="md:hidden p-1.5 -ml-1" onClick={() => setNavOpen(true)} style={{ color: T.paper }} aria-label="Mở menu">
            <Menu size={22} />
          </button>
          <Emblem size={38} ring />
          <div>
            <div className="f-mono text-[9.5px] tracking-[0.2em] uppercase" style={{ color: T.amber }}>Đại học Cảnh sát nhân dân</div>
            <div className="f-display text-sm md:text-base font-semibold tracking-wide" style={{ color: T.paper }}>QUẢN LÝ KÝ TÚC XÁ</div>
            {editingManager ? (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                <input
                  className="f-body text-[10.5px] px-1.5 py-0.5 rounded-sm w-28 input-plain"
                  style={{ background: "rgba(255,255,255,0.92)", color: T.ink, border: "none" }}
                  placeholder="Tên Ban quản lý"
                  value={managerForm.name}
                  onChange={(e) => setManagerForm({ ...managerForm, name: e.target.value })}
                />
                <input
                  className="f-mono text-[10.5px] px-1.5 py-0.5 rounded-sm w-24 input-plain"
                  style={{ background: "rgba(255,255,255,0.92)", color: T.ink, border: "none" }}
                  placeholder="Số điện thoại"
                  value={managerForm.phone}
                  onChange={(e) => setManagerForm({ ...managerForm, phone: e.target.value })}
                />
                <button onClick={saveManager} title="Lưu"><CheckCircle2 size={15} style={{ color: T.amber }} /></button>
                <button onClick={cancelEditManager} title="Huỷ"><X size={15} style={{ color: T.paper }} /></button>
              </div>
            ) : (
              (managerInfo.name || managerInfo.phone || canEditManager) && (
                <div className="f-mono text-[10px] mt-0.5" style={{ color: "rgba(237,230,214,0.75)" }}>
                  {managerInfo.name || managerInfo.phone ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>BAN QUẢN LÝ: {managerInfo.name || "—"}</span>
                      {canEditManager && (
                        <button onClick={startEditManager} title="Sửa thông tin Ban quản lý KTX">
                          <Pencil size={10} style={{ color: T.amber }} />
                        </button>
                      )}
                      <span className="basis-full">SỐ ĐT: {managerInfo.phone || "—"}</span>
                    </div>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <span className="italic">Chưa có thông tin Ban quản lý ký túc xá</span>
                      {canEditManager && (
                        <button onClick={startEditManager} title="Sửa thông tin Ban quản lý KTX">
                          <Pencil size={10} style={{ color: T.amber }} />
                        </button>
                      )}
                    </span>
                  )}
                </div>
              )
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-4">
          <span className="f-body text-sm hidden sm:flex items-center gap-2" style={{ color: T.paper }}>
            Xin chào, <b>{user}</b>
            <span
              className="f-display text-[10px] uppercase tracking-wider pl-1.5 pr-2.5 py-1 inline-flex items-center gap-1 rounded-full"
              style={{ background: T.amber, color: T.greenDark }}
            >
              <RoleIcon size={11} /> {roleBadge[perm.role]}
            </span>
          </span>
          <button
            onClick={() => { setUser(null); setIsAdminLogin(false); }}
            className="f-display text-xs uppercase flex items-center gap-1.5 px-3 py-1.5 btn-press rounded-sm"
            style={{ color: T.paper, border: `1px solid ${T.amber}` }}
          >
            <LogOut size={14} /> <span className="hidden sm:inline">Thoát</span>
          </button>
        </div>
      </header>

      <div className="flex">
        {navOpen && (
          <div
            className="fixed inset-0 z-40 md:hidden drawer-backdrop"
            style={{ background: "rgba(19,31,25,0.55)" }}
            onClick={() => setNavOpen(false)}
          />
        )}

        <nav
          className={`fixed md:sticky md:top-0 inset-y-0 left-0 z-50 md:z-auto w-64 md:w-56 shrink-0 flex flex-col transform transition-transform duration-300 md:translate-x-0 ${navOpen ? "translate-x-0" : "-translate-x-full"}`}
          style={{ background: T.green, height: "100vh" }}
        >
          <div className="flex items-center justify-between px-5 py-3 md:hidden" style={{ borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
            <span className="f-display text-xs uppercase tracking-widest" style={{ color: T.amber }}>Danh mục</span>
            <button onClick={() => setNavOpen(false)} style={{ color: T.paper }} aria-label="Đóng menu">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin py-0.5">
            {visibleTabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => goToTab(t.id)}
                  className={`nav-item w-full flex items-center gap-2.5 px-4 py-2 f-display text-[12.5px] uppercase tracking-wide text-left ${active ? "nav-item-active" : ""}`}
                  style={{
                    background: active ? T.amber : "transparent",
                    color: active ? T.greenDark : T.paper,
                    borderLeft: active ? `4px solid ${T.gold}` : "4px solid transparent",
                  }}
                >
                  <span
                    className="icon-badge icon-badge-sm"
                    style={{ background: active ? "rgba(19,31,25,0.12)" : "rgba(255,255,255,0.08)" }}
                  >
                    <Icon size={12} />
                  </span>
                  <span className="flex-1 leading-tight">{t.label}</span>
                </button>
              );
            })}
          </div>

          <div
            className="flex items-center gap-2.5 px-5 py-3 shrink-0"
            style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}
          >
            <Emblem size={24} />
            <span className="f-mono text-[9.5px] uppercase tracking-widest" style={{ color: "rgba(237,230,214,0.6)" }}>
              KÝ TÚC XÁ · ĐH CSND
            </span>
          </div>
        </nav>

        <main className="flex-1 min-w-0 p-4 md:p-8">
          <div
            className="max-w-6xl mx-auto p-5 md:p-9 card-sheet"
            style={{ background: T.paper, border: `1px solid ${T.paperDark}`, borderTop: `3px solid ${T.gold}` }}
          >
            {renderTab()}
          </div>
        </main>
      </div>

      <footer className="text-center f-mono text-[11px] py-4 space-y-1" style={{ color: T.inkSoft }}>
        <div>Ký túc xá — Trường Đại học Cảnh sát nhân dân</div>
      </footer>
    </div>
  );
}
