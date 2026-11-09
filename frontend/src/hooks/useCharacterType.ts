import { useState } from "react";
import type { AllowedType } from "../types";

const ALLOWED_KEY = "charvision-allowed";
const LOWERCASE_KEY = "charvision-show-lowercase";

export function useCharacterType(defaultType: AllowedType) {
  const [allowed, setAllowedState] = useState<AllowedType>(() => {
    const saved = localStorage.getItem(ALLOWED_KEY);
    return saved === "all" || saved === "digits" || saved === "letters" ? saved : defaultType;
  });
  const [showLowercase, setShowLowercaseState] = useState(
    () => localStorage.getItem(LOWERCASE_KEY) === "true",
  );

  const setAllowed = (next: AllowedType) => {
    localStorage.setItem(ALLOWED_KEY, next);
    setAllowedState(next);
  };
  const setShowLowercase = (next: boolean) => {
    localStorage.setItem(LOWERCASE_KEY, String(next));
    setShowLowercaseState(next);
  };

  return { allowed, setAllowed, showLowercase, setShowLowercase };
}
