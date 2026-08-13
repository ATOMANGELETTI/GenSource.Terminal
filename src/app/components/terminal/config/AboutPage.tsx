import type { AppInfo } from "../../../types";

interface AboutPageProps {
  appInfo: AppInfo | null;
}

const FIELDS: { key: keyof AppInfo; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "productName", label: "Product" },
  { key: "version", label: "Version" },
  { key: "codename", label: "Codename" },
  { key: "edition", label: "Edition" },
  { key: "identifier", label: "Identifier" },
  { key: "publisher", label: "Publisher" },
  { key: "description", label: "Description" },
];

export default function AboutPage({ appInfo }: AboutPageProps) {
  if (!appInfo) {
    return <p className="config-form__note">App info unavailable.</p>;
  }

  return (
    <div className="config-form config-about">
      {FIELDS.map(({ key, label }) => {
        const raw = appInfo[key];
        if (raw === undefined || raw === null || raw === "") return null;
        return (
          <div key={key} className="config-about__row">
            <span className="config-about__label">{label}</span>
            <span className="config-about__value">{String(raw)}</span>
          </div>
        );
      })}
      <p className="config-form__note">Read-only — edit appinfo.json on disk.</p>
    </div>
  );
}
