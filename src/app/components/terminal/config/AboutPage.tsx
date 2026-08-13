import type { AppInfo } from "../../../types";
import { ConfigCard, ConfigRow } from "./ConfigField";

interface AboutPageProps {
  appInfo: AppInfo | null;
}

const DETAIL_FIELDS: { key: keyof AppInfo; label: string }[] = [
  { key: "identifier", label: "Identifier" },
  { key: "publisher", label: "Publisher" },
  { key: "description", label: "Description" },
  { key: "name", label: "Name" },
];

export default function AboutPage({ appInfo }: AboutPageProps) {
  if (!appInfo) {
    return <p className="config-form__note">App info unavailable.</p>;
  }

  const product = appInfo.productName || appInfo.name;
  const metaParts = [
    appInfo.version ? `v${appInfo.version}` : null,
    appInfo.codename,
    appInfo.edition != null ? `Edition ${appInfo.edition}` : null,
  ].filter(Boolean);

  const details = DETAIL_FIELDS.filter(({ key }) => {
    if (key === "name" && appInfo.productName) return false;
    const raw = appInfo[key];
    return raw !== undefined && raw !== null && raw !== "";
  });

  return (
    <>
      <ConfigCard>
        <div className="config-about__identity">
          <p className="config-about__name">{product}</p>
          {metaParts.length > 0 ? (
            <p className="config-about__meta">{metaParts.join(" · ")}</p>
          ) : null}
        </div>
      </ConfigCard>

      {details.length > 0 ? (
        <ConfigCard label="Details">
          {details.map(({ key, label }) => (
            <ConfigRow
              key={key}
              label={label}
              layout={key === "description" || key === "identifier" ? "stack" : "inline"}
            >
              <span className="config-about__value">{String(appInfo[key])}</span>
            </ConfigRow>
          ))}
        </ConfigCard>
      ) : null}

      <p className="config-form__note">
        Read-only — edit appinfo.json on disk.
      </p>
    </>
  );
}
