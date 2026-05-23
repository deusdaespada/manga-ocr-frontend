import { useEffect, useState } from "react";

import { api } from "../lib/api";
import type { InpaintBackendInfo, InpaintBackendValue } from "../lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface InpaintBackendSelectProps {
  value: InpaintBackendValue;
  onValueChange: (value: InpaintBackendValue) => void;
}

export default function InpaintBackendSelect({
  value,
  onValueChange,
}: InpaintBackendSelectProps) {
  const [backends, setBackends] = useState<InpaintBackendInfo[]>([]);

  useEffect(() => {
    api.getInpaintBackends().then(setBackends).catch(() => {});
  }, []);

  if (backends.length === 0) {
    return (
      <Select
        value={value}
        onValueChange={(v) => onValueChange(v as InpaintBackendValue)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="migan">MIGAN ONNX (default)</SelectItem>
          <SelectItem value="lama">LaMa</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as InpaintBackendValue)}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {backends.map((b) => (
          <SelectItem key={b.value} value={b.value}>
            {b.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
