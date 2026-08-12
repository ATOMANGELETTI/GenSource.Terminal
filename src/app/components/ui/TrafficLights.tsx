import { useEffect, useState } from "react";

import {
  closeWindow,
  getWindow,
  isWindowMaximized,
  minimizeWindow,
  toggleMaximize,
} from "../../lib/window";

interface TrafficLightsProps {
  className?: string;
}

export default function TrafficLights({ className }: TrafficLightsProps) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = getWindow();
    if (!win) {
      return;
    }

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void isWindowMaximized().then((value) => {
      if (!cancelled) {
        setMaximized(value);
      }
    });

    void win
      .onResized(async () => {
        const next = await isWindowMaximized();
        if (!cancelled) {
          setMaximized(next);
        }
      })
      .then((fn) => {
        if (cancelled) {
          fn();
        } else {
          unlisten = fn;
        }
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const rootClass = className
    ? `traffic-lights ${className}`
    : "traffic-lights";

  return (
    <div className={rootClass}>
      <button
        type="button"
        className="traffic-light traffic-light--close"
        aria-label="Close"
        onClick={() => void closeWindow()}
      />
      <button
        type="button"
        className="traffic-light traffic-light--minimize"
        aria-label="Minimize"
        onClick={() => void minimizeWindow()}
      />
      <button
        type="button"
        className="traffic-light traffic-light--maximize"
        aria-label={maximized ? "Restore" : "Maximize"}
        onClick={() => void toggleMaximize()}
      />
    </div>
  );
}
