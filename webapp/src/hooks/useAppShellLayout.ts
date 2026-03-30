"use client";

import { useState } from "react";

export function useAppShellLayout() {
  const [showSettings, setShowSettings] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(374);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [mobileStep, setMobileStep] = useState<"hero" | "connect">("hero");

  return {
    showSettings,
    setShowSettings,
    showRightPanel,
    setShowRightPanel,
    focusMode,
    setFocusMode,
    leftWidth,
    setLeftWidth,
    rightWidth,
    setRightWidth,
    showChatDrawer,
    setShowChatDrawer,
    mobileStep,
    setMobileStep,
  };
}
