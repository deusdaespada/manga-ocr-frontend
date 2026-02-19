import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2 } from "lucide-react";

import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import GenrePicker from "../components/GenrePicker";

export default function NewProjectPage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [titleUz, setTitleUz] = useState("");
  const [titleRu, setTitleRu] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [titleJa, setTitleJa] = useState("");
  const [titleKo, setTitleKo] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [language, setLanguage] = useState<"ja" | "ko" | "ru" | "en">("ja");
  const [backend, setBackend] = useState<"openai" | "ollama" | "gemini">("openai");
  const [ocrBackend, setOcrBackend] = useState<"auto" | "openai" | "ollama">("auto");

  async function handleCreate() {
    if (!name.trim()) {
      setError("Manga nomini kiriting");
      return;
    }
    if (tags.length < 3) {
      setError("Kamida 3 ta janr tanlang");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await api.createProject({
        name: name.trim(),
        description: description.trim(),
        title_uz: titleUz.trim(),
        title_ru: titleRu.trim(),
        title_en: titleEn.trim(),
        title_ja: titleJa.trim(),
        title_ko: titleKo.trim(),
        tags,
        language,
        backend,
        ocr_backend: ocrBackend,
      });
      navigate(`/project/${result.name}`);
    } catch (e) {
      const err = e as Error;
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Yangi manga</h1>
        <p className="page-description">Manga loyihasini yarating va sozlamalarni belgilang.</p>
      </div>

      <div className="mx-auto max-w-2xl space-y-6">
        {/* Name */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Manga nomi <span className="text-red-400">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="masalan: one-piece"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Tavsif</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Manga haqida qisqacha ma'lumot..."
            className="min-h-[80px]"
          />
        </div>

        {/* Titles */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Sarlavhalar (turli tillarda)</label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">O'zbekcha</label>
              <Input value={titleUz} onChange={(e) => setTitleUz(e.target.value)} placeholder="O'zbek tilidagi nomi" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Ruscha</label>
              <Input value={titleRu} onChange={(e) => setTitleRu(e.target.value)} placeholder="Русское название" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Inglizcha</label>
              <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="English title" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Yaponcha</label>
              <Input value={titleJa} onChange={(e) => setTitleJa(e.target.value)} placeholder="日本語タイトル" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Koreyscha</label>
              <Input value={titleKo} onChange={(e) => setTitleKo(e.target.value)} placeholder="한국어 제목" />
            </div>
          </div>
        </div>

        {/* Genres */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Janrlar <span className="text-red-400">*</span>
          </label>
          <GenrePicker value={tags} onChange={setTags} />
        </div>

        {/* Pipeline settings inline */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Manba tili</label>
            <Select value={language} onValueChange={(v) => setLanguage(v as typeof language)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ja">Yaponcha (JA)</SelectItem>
                <SelectItem value="ko">Koreyscha (KO)</SelectItem>
                <SelectItem value="ru">Ruscha (RU)</SelectItem>
                <SelectItem value="en">Inglizcha (EN)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tarjima backend</label>
            <Select value={backend} onValueChange={(v) => setBackend(v as typeof backend)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="ollama">Ollama (Local)</SelectItem>
                <SelectItem value="gemini">Gemini</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">OCR backend</label>
            <Select value={ocrBackend} onValueChange={(v) => setOcrBackend(v as typeof ocrBackend)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Local (Auto)</SelectItem>
                <SelectItem value="openai">OpenAI Vision</SelectItem>
                <SelectItem value="ollama">Ollama Vision</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleCreate} disabled={saving || !name.trim()} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? "Yaratilmoqda..." : "Manga yaratish"}
          </Button>
          <Button variant="outline" onClick={() => navigate("/")}>
            Bekor qilish
          </Button>
        </div>
      </div>
    </div>
  );
}
