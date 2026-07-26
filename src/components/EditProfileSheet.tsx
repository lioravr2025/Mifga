import { useRef, useState, useEffect } from "react";
import { Camera, X } from "lucide-react";
import BottomSheet from "./BottomSheet";
import VehicleModelInput from "./VehicleModelInput";
import UsernameField from "./UsernameField";
import { VEHICLE_DEFS } from "./VehicleIcons";
import { useApp } from "../context/AppContext";
import type { VehicleTypeId } from "../types";

export default function EditProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, updateProfile } = useApp();
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username ?? "");
  const [usernameFieldOk, setUsernameFieldOk] = useState(true);
  const [photo, setPhoto] = useState<string | undefined>(user.avatarPhoto);
  const [vehicleType, setVehicleType] = useState<VehicleTypeId | undefined>(user.vehicleType);
  const [vehicleModel, setVehicleModel] = useState(user.vehicleModel ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(user.name);
      setUsername(user.username ?? "");
      setPhoto(user.avatarPhoto);
      setVehicleType(user.vehicleType);
      setVehicleModel(user.vehicleModel ?? "");
    }
  }, [open, user.name, user.username, user.avatarPhoto, user.vehicleType, user.vehicleModel]);

  // an empty field is fine here (username is optional post-onboarding in local mode); a non-empty one must pass UsernameField's live check
  const usernameOk = !username.trim() || usernameFieldOk;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const selectVehicle = (id: VehicleTypeId) => {
    setVehicleType((prev) => (prev === id ? undefined : id));
  };

  const save = () => {
    if (!name.trim() || !usernameOk) return;
    updateProfile({
      name: name.trim(),
      username: username.trim() || null,
      avatarPhoto: photo ?? null,
      vehicleType: vehicleType ?? null,
      vehicleModel: vehicleType ? vehicleModel.trim() || null : null,
    });
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="88%">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-neutral-50">עריכת פרופיל</h2>
        <button onClick={onClose} className="text-neutral-400">
          <X size={22} />
        </button>
      </div>

      <div className="flex flex-col items-center mb-5">
        <button onClick={() => fileRef.current?.click()} className="relative w-24 h-24 mb-2 active:scale-95 transition">
          {photo ? (
            <img src={photo} alt="" className="w-24 h-24 rounded-full object-cover border-2 border-brand" />
          ) : (
            <span className="w-24 h-24 rounded-full bg-bg-panel2 border-2 border-brand flex items-center justify-center text-5xl">
              {user.avatarEmoji}
            </span>
          )}
          <span className="absolute bottom-0 left-0 w-8 h-8 rounded-full bg-brand flex items-center justify-center border-2 border-bg-panel">
            <Camera size={15} className="text-white" />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <button onClick={() => fileRef.current?.click()} className="text-xs text-brand-light font-semibold">
          {photo ? "החלפת תמונה" : "העלאת תמונה"}
        </button>
      </div>

      <label className="text-xs text-neutral-400 mb-1.5 block">שם תצוגה</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="השם שלך"
        className="w-full px-4 py-3 rounded-2xl bg-bg-panel2 border border-bg-border text-sm text-neutral-100 outline-none focus:border-brand mb-5"
      />

      <label className="text-xs text-neutral-400 mb-1.5 block">שם משתמש (ייחודי)</label>
      <div className="mb-5">
        <UsernameField value={username} onChange={setUsername} excludeUsername={user.username} onValidityChange={setUsernameFieldOk} />
      </div>

      <label className="text-xs text-neutral-400 mb-1.5 block">הכלי שלי</label>
      <div className="grid grid-cols-3 gap-2.5 mb-3">
        {VEHICLE_DEFS.map(({ id, label, Icon }) => {
          const active = vehicleType === id;
          return (
            <button
              key={id}
              onClick={() => selectVehicle(id)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border active:scale-95 transition ${
                active ? "bg-brand/15 border-brand" : "bg-bg-panel2 border-bg-border"
              }`}
            >
              <span
                className={`w-11 h-11 rounded-full flex items-center justify-center border ${
                  active ? "bg-brand/20 border-brand" : "bg-bg-panel border-bg-border"
                }`}
              >
                <Icon size={20} color={active ? "#a78bfa" : "#9ca3af"} />
              </span>
              <span className={`text-[11px] font-semibold text-center leading-tight ${active ? "text-brand-light" : "text-neutral-300"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
      {vehicleType && (
        <div className="mb-5">
          <VehicleModelInput type={vehicleType} value={vehicleModel} onChange={setVehicleModel} />
        </div>
      )}

      <button
        onClick={save}
        disabled={!name.trim() || !usernameOk}
        className="w-full py-3.5 rounded-2xl bg-brand text-white font-bold text-base disabled:opacity-40 active:scale-95 transition"
      >
        שמירה
      </button>
    </BottomSheet>
  );
}
