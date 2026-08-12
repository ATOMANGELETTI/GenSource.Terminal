import {
  FindIcon,
  FolderIcon,
  NewFileIcon,
  NewFolderIcon,
  ReloadIcon,
} from "../../icons/MenuIcons";

interface ExplorerHeaderProps {
  username: string;
  searchOpen: boolean;
  searchQuery: string;
  onToggleSearch: () => void;
  onSearchChange: (value: string) => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRefresh: () => void;
}

export default function ExplorerHeader({
  username,
  searchOpen,
  searchQuery,
  onToggleSearch,
  onSearchChange,
  onNewFile,
  onNewFolder,
  onRefresh,
}: ExplorerHeaderProps) {
  return (
    <div className="explorer-header">
      <div className="explorer-header__row">
        <div className="explorer-header__user" title={username}>
          <FolderIcon className="explorer-header__user-icon" />
          <span className="explorer-header__username">{username}</span>
        </div>
        <div className="explorer-header__actions">
          <button
            type="button"
            className={
              searchOpen
                ? "explorer-header__btn explorer-header__btn--active"
                : "explorer-header__btn"
            }
            title="Search"
            aria-label="Search"
            aria-pressed={searchOpen}
            onClick={onToggleSearch}
          >
            <FindIcon />
          </button>
          <button
            type="button"
            className="explorer-header__btn"
            title="New File"
            aria-label="New File"
            onClick={onNewFile}
          >
            <NewFileIcon />
          </button>
          <button
            type="button"
            className="explorer-header__btn"
            title="New Folder"
            aria-label="New Folder"
            onClick={onNewFolder}
          >
            <NewFolderIcon />
          </button>
          <button
            type="button"
            className="explorer-header__btn"
            title="Refresh"
            aria-label="Refresh"
            onClick={onRefresh}
          >
            <ReloadIcon />
          </button>
        </div>
      </div>
      {searchOpen ? (
        <input
          className="explorer-header__search"
          type="search"
          value={searchQuery}
          placeholder="Filter files…"
          aria-label="Filter files"
          autoFocus
          onChange={(event) => onSearchChange(event.target.value)}
        />
      ) : null}
    </div>
  );
}
