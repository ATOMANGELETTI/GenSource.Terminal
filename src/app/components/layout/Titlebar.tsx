import type { MouseEvent } from "react";

import TrafficLights from "../ui/TrafficLights";
import { toggleMaximize } from "../../lib/window";

interface TitlebarProps {
  title?: string;
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
}

export default function Titlebar({
  title = "GenSource Terminal",
  onContextMenu,
}: TitlebarProps) {
  const handleDoubleClick = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest(".traffic-lights")) {
      return;
    }
    void toggleMaximize();
  };

  return (
    <header
      className="titlebar"
      onDoubleClick={handleDoubleClick}
      onContextMenu={onContextMenu}
    >
      <div className="titlebar__drag" data-tauri-drag-region />
      <TrafficLights />
      <h1 className="titlebar__title">{title}</h1>
      <div className="titlebar__spacer" aria-hidden="true" />
    </header>
  );
}
