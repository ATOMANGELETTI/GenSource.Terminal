import Tab, { type TabProps } from "./Tab";

export interface TabBarTab
  extends Omit<TabProps, "onSelect" | "onClose" | "onTogglePin" | "active"> {
  active: boolean;
}

export interface TabBarProps {
  tabs: TabBarTab[];
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onTogglePin: (tabId: string) => void;
  onAdd: () => void;
}

export default function TabBar({
  tabs,
  onSelect,
  onClose,
  onTogglePin,
  onAdd,
}: TabBarProps) {
  return (
    <div className="tab-bar" data-testid="tab-bar" role="tablist">
      <div className="tab-bar__tabs">
        {tabs.map((tab) => (
          <Tab
            key={tab.tabId}
            tabId={tab.tabId}
            title={tab.title}
            active={tab.active}
            pinned={tab.pinned}
            status={tab.status}
            onSelect={onSelect}
            onClose={onClose}
            onTogglePin={onTogglePin}
          />
        ))}
      </div>
      <button
        type="button"
        className="tab-bar__add"
        aria-label="New tab"
        title="New tab"
        onClick={onAdd}
      >
        +
      </button>
    </div>
  );
}
