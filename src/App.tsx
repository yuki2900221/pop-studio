import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  FileDown,
  FilePlus2,
  FolderOpen,
  Grid2X2,
  ImagePlus,
  LayoutTemplate,
  Leaf,
  List,
  LoaderCircle,
  Maximize,
  Minus,
  Plus,
  Printer,
  Redo2,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
  X,
  ZoomIn,
} from "lucide-react";
import PopArtwork from "./components/PopArtwork";
import PaperSelect, { paperLabels } from "./components/PaperSelect";
import PrintQueueView from "./components/PrintQueueView";
import CopiesInput from "./components/CopiesInput";
import PrintSheetPreview from "./components/PrintSheetPreview";
import "./print-queue.css";
import {
  templates,
  categories,
  createDocument,
  loadDocuments,
  saveDocuments,
  validateDocument,
  taxIncluded,
  formatPrice,
  b5Layouts,
  isB5Paper,
  type PopDocument,
  type Template,
} from "./lib/model";
import {
  buildPrintSheets,
  paperDimensions,
  printBatch,
  printDocument,
  type PrintEntry,
} from "./lib/print";
import {
  loadPrintQueue,
  savePrintQueue,
  makeQueueEntry,
  nextProductDocument,
} from "./lib/print-queue";
import {
  SALE_FONT_URL,
  PRICE_FONT_URL,
  saleFontCss,
} from "./lib/artwork-fonts";

type View = "templates" | "saved" | "editor" | "queue";
type Modal =
  | "print"
  | "ai"
  | "settings"
  | "help"
  | "templates"
  | "delete"
  | "discard"
  | null;
const palette = [
  "#285b45",
  "#bc4432",
  "#d18b23",
  "#256579",
  "#3f4147",
  "#9b5267",
];
const fade = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.23 },
};
function templatePaper(t: Template, paper: PopDocument["paper"]) {
  return t.theme === "sale" && !isB5Paper(paper) ? "B5" : paper;
}
function IconButton({
  label,
  children,
  onClick,
  disabled = false,
  active = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      className={`icon-button ${active ? "active" : ""}`}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
function Skeleton() {
  return (
    <div className="skeleton-app" role="status" aria-label="アプリを読み込み中">
      <aside>
        <div className="skeleton sk-logo" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton sk-nav" />
        ))}
      </aside>
      <main>
        <div className="sk-top">
          <div className="skeleton sk-title" />
          <div className="skeleton sk-button" />
        </div>
        <div className="skeleton sk-heading" />
        <div className="sk-filters">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton sk-chip" />
          ))}
        </div>
        <div className="sk-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div className="sk-card" key={i}>
              <div className="skeleton sk-poster" />
              <div className="skeleton sk-line" />
              <div className="skeleton sk-line short" />
            </div>
          ))}
        </div>
        <span className="loading-caption">POP STUDIO を読み込み中</span>
      </main>
    </div>
  );
}

/** Untitled products take their name from the product so lists stay distinguishable. */
function withProductName(doc: PopDocument): PopDocument {
  const product = doc.productName.trim();
  return doc.name === "新しいPOP" && product
    ? { ...doc, name: `${product}のPOP`.slice(0, 100) }
    : doc;
}
export default function App() {
  const [loading, setLoading] = useState(true),
    [view, setView] = useState<View>("templates"),
    [docs, setDocs] = useState<PopDocument[]>([]),
    [doc, setDoc] = useState<PopDocument>(() => createDocument(templates[0]));
  const [queue, setQueue] = useState<PrintEntry[]>([]);
  const [queueDraftId, setQueueDraftId] = useState<string | null>(null);
  const [pendingLeave, setPendingLeave] = useState<View | null>(null);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const productNameRef = useRef<HTMLInputElement>(null);
  const focusProductRef = useRef(false);
  const [history, setHistory] = useState<PopDocument[]>([]),
    [future, setFuture] = useState<PopDocument[]>([]),
    [category, setCategory] = useState("すべて"),
    [query, setQuery] = useState(""),
    [size, setSize] = useState<PopDocument["paper"]>(() => {
      try {
        const paper = localStorage.getItem("pop-studio.paper.v1");
        return paper === "A4" ||
          paper === "A5" ||
          paper === "shelf" ||
          (paper !== null && isB5Paper(paper as PopDocument["paper"]))
          ? (paper as PopDocument["paper"])
          : "B5";
      } catch {
        return "B5";
      }
    }),
    [listMode, setListMode] = useState(false);
  const [modal, setModal] = useState<Modal>(null),
    [panel, setPanel] = useState<"product" | "design">("product"),
    [toast, setToast] = useState(""),
    [zoom, setZoom] = useState(85),
    [copies, setCopies] = useState(1),
    [dirty, setDirty] = useState(false),
    [aiText, setAiText] = useState(""),
    [aiBusy, setAiBusy] = useState(false),
    [aiResult, setAiResult] = useState<Record<
      string,
      string | number | null
    > | null>(null),
    [aiError, setAiError] = useState(""),
    [aiReady, setAiReady] = useState<boolean | null>(null);
  const [importError, setImportError] = useState(""),
    [deleteId, setDeleteId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null),
    importRef = useRef<HTMLInputElement>(null),
    previousFocus = useRef<HTMLElement | null>(null),
    modalRef = useRef<HTMLDivElement>(null),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    aiController = useRef<AbortController | null>(null);
  const workspaceRef = useRef({ doc, docs, view, dirty, queueDraftId, copies });
  workspaceRef.current = { doc, docs, view, dirty, queueDraftId, copies };
  const notify = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3600);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const storage = window.localStorage;
        setDocs(loadDocuments(storage));
        setQueue(loadPrintQueue(storage));
      } catch {
        notify(
          "端末内の保存を利用できません。ブラウザの保存設定を確認してください",
        );
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => {
      clearTimeout(timer);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [notify]);
  useEffect(() => {
    if (modal === "ai") {
      let mounted = true;
      fetch("/api/health")
        .then((r) => r.json())
        .then((d) => {
          if (mounted) setAiReady(d.ai === true);
        })
        .catch(() => {
          if (mounted) setAiReady(false);
        });
      return () => {
        mounted = false;
      };
    }
  }, [modal]);
  useEffect(() => {
    if (!modal) return;
    previousFocus.current = document.activeElement as HTMLElement;
    const timer = setTimeout(
      () =>
        modalRef.current
          ?.querySelector<HTMLElement>("input,textarea,button,select")
          ?.focus(),
      40,
    );
    function trap(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (aiBusy) aiController.current?.abort();
        setModal(null);
      }
      if (e.key === "Tab") {
        const items = modalRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]',
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", trap);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", trap);
      previousFocus.current?.focus();
    };
  }, [modal, aiBusy]);
  const patch = (changes: Partial<PopDocument>) => {
    const current = workspaceRef.current.doc;
    const next = {
      ...current,
      ...changes,
      updatedAt: new Date().toISOString(),
    };
    workspaceRef.current = { ...workspaceRef.current, doc: next, dirty: true };
    setHistory((h) => [...h.slice(-49), current]);
    setFuture([]);
    setDoc(next);
    setDirty(true);
  };
  const undo = useCallback(() => {
    if (!history.length) return;
    setFuture((f) => [doc, ...f]);
    setDoc(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setDirty(true);
  }, [history, doc]);
  const redo = useCallback(() => {
    if (!future.length) return;
    setHistory((h) => [...h, doc]);
    setDoc(future[0]);
    setFuture((f) => f.slice(1));
    setDirty(true);
  }, [future, doc]);
  const persist = (next: PopDocument[]) => {
    const result = saveDocuments(window.localStorage, next);
    if (!result.ok) {
      notify(result.error || "保存できませんでした");
      return false;
    }
    setDocs(next);
    return true;
  };
  const save = useCallback(() => {
    if (!doc.productName.trim()) {
      notify("商品名を入力してください");
      return;
    }
    if (!/^\d{1,7}$/.test(doc.price) || Number(doc.price) > 1000000) {
      notify("本体価格を0〜1,000,000円の整数で入力してください");
      return;
    }
    const next = {
      ...withProductName(doc),
      updatedAt: new Date().toISOString(),
    };
    const existing = docs.some((d) => d.id === doc.id);
    const nextDocs = existing
      ? docs.map((d) => (d.id === doc.id ? next : d))
      : [next, ...docs];
    const result = saveDocuments(window.localStorage, nextDocs);
    if (!result.ok) {
      notify(result.error || "保存できませんでした");
      return;
    }
    setDocs(nextDocs);
    setDoc(next);
    setDirty(false);
    notify("下書きを保存しました");
  }, [doc, docs, notify]);
  useEffect(() => {
    function shortcuts(e: KeyboardEvent) {
      if (modal || (!e.metaKey && !e.ctrlKey)) return;
      if (view === "queue" && e.key.toLowerCase() === "p") {
        e.preventDefault();
        const result = printBatch(queueRef.current);
        if (!result.ok) notify(result.error || "印刷画面を開けませんでした");
        return;
      }
      if (view !== "editor") return;
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
      if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        setModal("print");
      }
      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
    }
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, [view, save, undo, redo, modal, notify]);
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [dirty]);
  const start = (t: Template) => {
    const next = createDocument(t);
    next.paper = templatePaper(t, size);
    workspaceRef.current = {
      ...workspaceRef.current,
      doc: next,
      dirty: false,
      view: "editor",
    };
    setDoc(next);
    setQueueDraftId(null);
    setCopies(1);
    setHistory([]);
    setFuture([]);
    setDirty(false);
    setView("editor");
    setPanel("product");
    setQuery("");
    setModal(null);
  };
  /** Opening another product never inherits the previous product's print count. */
  const openDoc = (d: PopDocument) => {
    workspaceRef.current = {
      ...workspaceRef.current,
      doc: { ...d },
      dirty: false,
      view: "editor",
      copies: 1,
    };
    setDoc({ ...d });
    setQueueDraftId(null);
    setCopies(1);
    setHistory([]);
    setFuture([]);
    setDirty(false);
    setView("editor");
    setPanel("product");
  };
  const persistQueue = (entries: PrintEntry[]) => {
    const result = savePrintQueue(window.localStorage, entries);
    if (!result.ok) {
      notify(result.error || "印刷待ちを保存できませんでした");
      return false;
    }
    queueRef.current = entries;
    setQueue(entries);
    return true;
  };
  const beginNextProduct = (base: PopDocument) => {
    const next = nextProductDocument(base);
    focusProductRef.current = true;
    openDoc(next);
    setAiText("");
    setAiResult(null);
    setAiError("");
  };
  const enqueue = (advance: boolean) => {
    if (doc.theme === "sale" && !isB5Paper(doc.paper)) {
      notify("POPサイズをB5・B5 1/2・B5 1/4・B5 1/8から選択してください");
      return;
    }
    try {
      const snapshot = withProductName(doc);
      const entry = makeQueueEntry(snapshot, copies);
      const current = queueRef.current;
      const replacing =
        queueDraftId !== null &&
        current.some((item) => item.id === queueDraftId);
      if (replacing) entry.id = queueDraftId!;
      const next = replacing
        ? current.map((item) => (item.id === entry.id ? entry : item))
        : [...current, entry];
      if (!persistQueue(next)) return;
      if (advance) beginNextProduct(snapshot);
      else {
        setQueueDraftId(entry.id);
        setDoc(snapshot);
        setDirty(false);
        workspaceRef.current = {
          ...workspaceRef.current,
          doc: snapshot,
          dirty: false,
        };
      }
      notify(replacing ? "印刷待ちを更新しました" : "印刷待ちに追加しました");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "入力内容を確認してください",
      );
    }
  };
  const updateQueueEntry = (
    id: string,
    changes: Partial<Pick<PrintEntry, "copies">> & {
      paper?: PopDocument["paper"];
    },
  ) => {
    persistQueue(
      queueRef.current.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              copies: changes.copies ?? entry.copies,
              doc: changes.paper
                ? {
                    ...entry.doc,
                    paper: changes.paper,
                    orientation: isB5Paper(changes.paper)
                      ? "landscape"
                      : entry.doc.orientation,
                  }
                : entry.doc,
            }
          : entry,
      ),
    );
  };
  const leave = (next: View) => {
    const queued = queueRef.current.find((entry) => entry.id === queueDraftId);
    if (
      view === "editor" &&
      queued &&
      (dirty ||
        queued.copies !== copies ||
        JSON.stringify(queued.doc) !== JSON.stringify(doc))
    ) {
      try {
        const entry = { ...makeQueueEntry(doc, copies), id: queued.id };
        if (
          !persistQueue(
            queueRef.current.map((item) =>
              item.id === queued.id ? entry : item,
            ),
          )
        )
          return;
        setDirty(false);
        workspaceRef.current = { ...workspaceRef.current, dirty: false };
      } catch {
        // Incomplete edits cannot replace the queued snapshot; let the user
        // choose between finishing them and discarding them.
        setPendingLeave(next);
        setModal("discard");
        return;
      }
    } else if (view === "editor" && dirty) {
      const draft = withProductName(doc);
      const result = saveDocuments(
        window.localStorage,
        docs.some((d) => d.id === doc.id)
          ? docs.map((d) => (d.id === doc.id ? draft : d))
          : [draft, ...docs],
      );
      if (!result.ok) {
        notify("未保存の変更があります。先に書き出してください");
        return;
      }
      setDocs(loadDocuments(window.localStorage));
      setDirty(false);
      // Leaving saves silently otherwise; say where the edits went.
      notify("編集中のPOPを下書きに保存しました");
    }
    setView(next);
    setQuery("");
  };
  /** Restore the queued snapshot, so returning to the editor shows what will print. */
  const discardQueuedEdits = () => {
    const queued = queueRef.current.find((entry) => entry.id === queueDraftId);
    const target = pendingLeave;
    setPendingLeave(null);
    setModal(null);
    if (queued) {
      const restored = { ...queued.doc };
      setDoc(restored);
      setCopies(queued.copies);
      workspaceRef.current = {
        ...workspaceRef.current,
        doc: restored,
        copies: queued.copies,
        dirty: false,
      };
    }
    setHistory([]);
    setFuture([]);
    setDirty(false);
    if (target) {
      setView(target);
      setQuery("");
    }
  };
  const duplicate = (d: PopDocument) => {
    const copy = {
      ...d,
      id: crypto.randomUUID(),
      name: `${d.name} のコピー`,
      updatedAt: new Date().toISOString(),
    };
    if (persist([copy, ...docs])) notify("POPを複製しました");
  };
  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(doc, null, 2)], {
      type: "application/json",
    });
    downloadBlob(blob, `${doc.name || "POP"}.json`);
    notify("POPデータを書き出しました");
  };
  const importJson = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 6000000) {
      setImportError("ファイルは6MB以下にしてください");
      return;
    }
    try {
      const data: unknown = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : [data];
      if (!list.length || list.length > 100 || !list.every(validateDocument))
        throw Error();
      const imported = list.map((d) => ({
        ...d,
        id: crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
      }));
      const current = workspaceRef.current;
      const queued = queueRef.current.find(
        (entry) => entry.id === current.queueDraftId,
      );
      if (current.view === "editor" && queued) {
        try {
          const updated = {
            ...makeQueueEntry(current.doc, current.copies),
            id: queued.id,
          };
          if (
            !persistQueue(
              queueRef.current.map((entry) =>
                entry.id === queued.id ? updated : entry,
              ),
            )
          )
            return;
        } catch {
          notify(
            "印刷待ちを更新するため、商品名と正しい本体価格を入力してください",
          );
          return;
        }
      }
      let retained = current.docs;
      if (current.view === "editor" && current.dirty)
        retained = retained.some((d) => d.id === current.doc.id)
          ? retained.map((d) => (d.id === current.doc.id ? current.doc : d))
          : [current.doc, ...retained];
      if (persist([...imported, ...retained])) {
        setDirty(false);
        setImportError("");
        setView("saved");
        notify(`${imported.length}件のPOPを読み込みました`);
      }
    } catch {
      setImportError(
        "有効なPOPデータではありません。書き出したJSONを選択してください",
      );
    }
  };
  const uploadImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const targetId = workspaceRef.current.doc.id;
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      notify("PNG・JPEG・WebP画像を選択してください");
      return;
    }
    if (file.size > 4000000) {
      notify("画像は4MB以下にしてください");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const ratio = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * ratio);
      canvas.height = Math.round(bitmap.height * ratio);
      canvas
        .getContext("2d")!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      if (workspaceRef.current.doc.id !== targetId) return;
      patch({ image: canvas.toDataURL("image/webp", 0.86) });
      notify("商品画像を変更しました");
    } catch {
      notify("画像を読み込めませんでした");
    }
  };
  const exportPng = async () => {
    if (
      !doc.productName.trim() ||
      !/^\d{1,7}$/.test(doc.price) ||
      Number(doc.price) > 1000000
    ) {
      notify("商品名と正しい本体価格を入力してください");
      return;
    }
    const original = document.getElementById(
      "editor-artwork",
    ) as SVGSVGElement | null;
    if (!original) return;
    try {
      const svg = original.cloneNode(true) as SVGSVGElement;
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      if (doc.theme === "sale") {
        const fontSources = await Promise.all(
          [SALE_FONT_URL, PRICE_FONT_URL].map(async (url) => {
            const response = await fetch(url);
            if (!response.ok) throw Error("POP書体を読み込めませんでした");
            const fontBlob = await response.blob();
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = reject;
              reader.readAsDataURL(fontBlob);
            });
          }),
        );
        const fontStyle = svg.querySelector("style[data-pop-font]");
        if (!fontStyle) throw Error("POP書体がありません");
        fontStyle.textContent = saleFontCss(fontSources[0], fontSources[1]);
      }
      const imageNode = svg.querySelector("image");
      if (imageNode && doc.image?.startsWith("/images/")) {
        const blob = await (await fetch(doc.image)).blob();
        imageNode.setAttribute(
          "href",
          await new Promise<string>((resolve) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result));
            r.readAsDataURL(blob);
          }),
        );
      }
      const data = new XMLSerializer().serializeToString(svg),
        url = URL.createObjectURL(
          new Blob([data], { type: "image/svg+xml;charset=utf-8" }),
        );
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = svg.viewBox.baseVal.width * 3;
      canvas.height = svg.viewBox.baseVal.height * 3;
      canvas
        .getContext("2d")!
        .drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const blob = await new Promise<Blob | null>((r) =>
        canvas.toBlob(r, "image/png"),
      );
      if (!blob) throw Error();
      downloadBlob(blob, `${doc.name || "POP"}.png`);
      notify("PNG画像を書き出しました");
    } catch {
      notify("画像を書き出せませんでした。印刷・PDF保存をご利用ください");
    }
  };
  const runAi = async () => {
    if (!aiText.trim()) return;
    setAiBusy(true);
    setAiError("");
    setAiResult(null);
    const controller = new AbortController();
    aiController.current = controller;
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const r = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: "extract", text: aiText }),
        signal: controller.signal,
        // An expired Access session answers with a redirect to the login page.
        redirect: "manual",
      });
      if (r.type === "opaqueredirect" || r.status === 401)
        throw Error(
          "ログインの有効期限が切れました。ページを再読み込みしてログインし直してください",
        );
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "AIを利用できませんでした");
      if (
        !data ||
        typeof data !== "object" ||
        !["productName", "origin", "unit", "price"].every((k) => k in data)
      )
        throw Error("AIの応答を読み込めませんでした");
      if (Object.values(data).every((value) => value === null)) {
        throw Error(
          "商品情報が見つかりませんでした。商品名や本体価格を追記してください",
        );
      }
      setAiResult(data);
    } catch (e) {
      setAiError(
        e instanceof Error && e.name === "AbortError"
          ? "処理を中断しました。時間をおいて再試行してください"
          : e instanceof Error
            ? e.message
            : "AIを利用できませんでした",
      );
    } finally {
      clearTimeout(timeout);
      setAiBusy(false);
      aiController.current = null;
    }
  };
  const applyAi = () => {
    if (!aiResult) return;
    const next: Partial<PopDocument> = {};
    for (const key of ["productName", "origin", "unit"] as const)
      if (typeof aiResult[key] === "string")
        next[key] = aiResult[key] as string;
    if (typeof aiResult.price === "number") next.price = String(aiResult.price);
    patch(next);
    setModal(null);
    notify("確認した商品情報を反映しました");
  };
  const filtered = templates.filter(
    (t) =>
      (category === "すべて" || t.category === category) &&
      `${t.name} ${t.category} ${t.productName}`.includes(query),
  );
  const filteredDocs = docs.filter((d) =>
    `${d.name} ${d.productName} ${d.origin}`.includes(query),
  );
  const validPrint =
    validateDocument(doc) &&
    !!doc.productName.trim() &&
    /^\d{1,7}$/.test(doc.price) &&
    Number(doc.price) <= 1000000;
  const canEnqueue =
    validPrint && !(doc.theme === "sale" && !isB5Paper(doc.paper));
  const dimensions = paperDimensions(doc);
  const singleSheets = validPrint
    ? buildPrintSheets([{ id: "current", doc, copies }])
    : [];
  const queuePopCount = queue.reduce((total, entry) => total + entry.copies, 0);
  if (loading) return <Skeleton />;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            leave("templates");
          }}
          aria-label="POP STUDIO ホーム"
        >
          <span className="brand-mark">
            <LayoutTemplate size={22} />
            <i />
          </span>
          <span>
            POP<span className="brand-light"> STUDIO</span>
          </span>
        </a>
        <div className="workspace-label">
          ワークスペース <span>LOCAL</span>
        </div>
        <nav aria-label="メインナビゲーション">
          <button
            aria-label="テンプレート"
            className={view === "templates" ? "nav-item selected" : "nav-item"}
            onClick={() => leave("templates")}
          >
            <LayoutTemplate size={19} />
            <span>テンプレート</span>
            <ChevronRight size={15} />
          </button>
          <button
            aria-label={`保存したPOP ${docs.length}`}
            className={view === "saved" ? "nav-item selected" : "nav-item"}
            onClick={() => leave("saved")}
          >
            <FolderOpen size={19} />
            <span>保存したPOP</span>
            <small>{docs.length}</small>
          </button>
          <button
            aria-label={`印刷待ち ${queuePopCount}`}
            className={view === "queue" ? "nav-item selected" : "nav-item"}
            onClick={() => leave("queue")}
          >
            <Printer size={19} />
            <span>印刷待ち</span>
            <small>{queuePopCount}</small>
          </button>
          {view === "editor" && (
            <button
              aria-label="POPを編集"
              className="nav-item selected"
              onClick={() => {}}
            >
              <FilePlus2 size={19} />
              <span>POPを編集</span>
              <span className="green-dot" />
            </button>
          )}
        </nav>
        <div className="sidebar-divider" />
        <div className="sidebar-section">ツール</div>
        <button
          aria-label="データを読み込む"
          className="nav-item"
          onClick={() => importRef.current?.click()}
        >
          <Upload size={18} />
          <span>データを読み込む</span>
        </button>
        <button
          aria-label="印刷設定"
          className="nav-item"
          onClick={() => setModal("settings")}
        >
          <Settings2 size={18} />
          <span>印刷設定</span>
        </button>
        <div className="sidebar-bottom">
          <div className="storage-card">
            <span className="storage-icon">
              <ShieldCheck size={20} />
            </span>
            <div>
              <strong>この端末に保存</strong>
              <span>下書きは端末内で管理</span>
            </div>
            <span className="green-dot" />
          </div>
          <button className="help-link" onClick={() => setModal("help")}>
            <CircleHelp size={17} />
            使い方・ショートカット
            <ChevronRight size={14} />
          </button>
          <div className="sidebar-footer">
            <div>
              <strong>POP STUDIO</strong>
              <span>
                バージョン <b>1.0</b>
              </span>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>ワークスペース</span>
            <ChevronRight size={14} />
            <strong>
              {view === "editor"
                ? "POPを編集"
                : view === "queue"
                  ? "印刷待ち"
                  : view === "saved"
                    ? "保存したPOP"
                    : "テンプレート"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="device-status">
              <span className="green-dot" />
              ローカル保存
            </span>
            <span className="topbar-divider" />
            <button
              className="topbar-help"
              onClick={() => setModal("help")}
              aria-label="ヘルプ"
            >
              <CircleHelp size={19} />
            </button>
          </div>
        </header>
        <AnimatePresence mode="wait">
          {view === "queue" ? (
            <motion.div key="queue" {...fade}>
              <PrintQueueView
                entries={queue}
                onChange={updateQueueEntry}
                onRemove={(id) => {
                  if (
                    persistQueue(
                      queueRef.current.filter((entry) => entry.id !== id),
                    )
                  ) {
                    if (queueDraftId === id) setQueueDraftId(null);
                    notify("印刷待ちから外しました");
                  }
                }}
                onEdit={(entry) => {
                  openDoc(entry.doc);
                  setCopies(entry.copies);
                  setQueueDraftId(entry.id);
                }}
                onNew={() =>
                  beginNextProduct(
                    queue[queue.length - 1]?.doc ?? {
                      ...createDocument(templates[0]),
                      paper: templatePaper(templates[0], size),
                    },
                  )
                }
                onPrint={() => {
                  const result = printBatch(queueRef.current);
                  if (!result.ok)
                    notify(result.error || "印刷画面を開けませんでした");
                }}
              />
            </motion.div>
          ) : view !== "editor" ? (
            <motion.main key={view} className="library-main" {...fade}>
              <div className="page-heading">
                <div>
                  <h1>
                    {view === "saved" ? "保存したPOP" : "テンプレート"}
                    <span className="heading-count">
                      {view === "saved" ? docs.length : templates.length}
                    </span>
                  </h1>
                  <p>
                    {view === "saved"
                      ? "この端末に保存したPOPを編集・印刷"
                      : "デザインを選んで、商品情報を入力"}
                  </p>
                </div>
                <button
                  className="primary-button"
                  onClick={() => start(templates[0])}
                >
                  <Plus size={18} />
                  新しいPOP
                </button>
              </div>
              {importError && (
                <div className="error-banner" role="alert">
                  {importError}
                  <button
                    onClick={() => setImportError("")}
                    aria-label="エラーを閉じる"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              <div className="library-toolbar">
                <div className="search-box">
                  <Search size={18} />
                  <input
                    aria-label="テンプレートやPOPを検索"
                    placeholder={
                      view === "saved" ? "POPを検索" : "テンプレートを検索"
                    }
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button
                      aria-label="検索をクリア"
                      onClick={() => setQuery("")}
                    >
                      <X size={15} />
                    </button>
                  )}
                  <kbd>⌕</kbd>
                </div>
                <div className="library-controls">
                  {view === "templates" && (
                    <label className="size-select">
                      <span>用紙</span>
                      <PaperSelect
                        label="用紙サイズ"
                        value={size}
                        onChange={setSize}
                      />
                      <ChevronDown size={14} />
                    </label>
                  )}
                  <div className="view-toggle">
                    <IconButton
                      label="グリッド表示"
                      active={!listMode}
                      onClick={() => setListMode(false)}
                    >
                      <Grid2X2 size={17} />
                    </IconButton>
                    <IconButton
                      label="リスト表示"
                      active={listMode}
                      onClick={() => setListMode(true)}
                    >
                      <List size={18} />
                    </IconButton>
                  </div>
                </div>
              </div>
              {view === "templates" && (
                <div
                  className="category-row"
                  role="group"
                  aria-label="商品カテゴリ"
                >
                  {categories.map((c: string) => (
                    <button
                      key={c}
                      className={`category-button ${category === c ? "active" : ""}`}
                      onClick={() => setCategory(c)}
                    >
                      {c === "青果" && <Leaf size={14} />}
                      <span>{c}</span>
                      {c === "すべて" && <small>{templates.length}</small>}
                    </button>
                  ))}
                </div>
              )}
              <div className="section-heading">
                <h2>
                  {view === "saved"
                    ? "すべてのPOP"
                    : category === "すべて"
                      ? "すべてのテンプレート"
                      : `${category}のテンプレート`}
                </h2>
                <span>
                  {view === "saved" ? filteredDocs.length : filtered.length} 件
                  <span className="muted-divider">/</span>
                  {view === "saved" ? "更新順" : "デザイン順"}
                </span>
              </div>
              {view === "templates" ? (
                <motion.div
                  layout
                  className={`template-grid ${listMode ? "list-mode" : ""}`}
                >
                  {filtered.map((t, index) => (
                    <motion.button
                      layout
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.3,
                        delay: Math.min(index * 0.035, 0.2),
                      }}
                      className="template-card"
                      key={t.id}
                      onClick={() => start(t)}
                    >
                      <div className={`card-artwork ${t.theme}`}>
                        <div className="poster-shadow">
                          <PopArtwork
                            doc={{
                              ...createDocument(t),
                              paper: templatePaper(t, size),
                            }}
                          />
                        </div>
                        <span className="template-hover-action">
                          <Plus size={16} />
                          このデザインを使う
                        </span>
                        <span className="paper-tag">
                          {paperLabels[templatePaper(t, size)]}
                        </span>
                      </div>
                      <div className="card-meta">
                        <div>
                          <h3>{t.name}</h3>
                          <span>
                            {t.category}
                            <i />{" "}
                            {t.theme === "sale"
                              ? "店舗の特売書式"
                              : t.theme === "minimal"
                                ? "シンプル"
                                : t.theme === "bold"
                                  ? "文字を大きく"
                                  : t.theme === "organic"
                                    ? "ナチュラル"
                                    : "写真・イラスト"}
                          </span>
                        </div>
                        <span className="card-open">
                          <ArrowUpRight />
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              ) : (
                <div
                  className={`template-grid saved-grid ${listMode ? "list-mode" : ""}`}
                >
                  {filteredDocs.map((d) => (
                    <motion.article
                      layout
                      className="template-card saved-card"
                      key={d.id}
                    >
                      <button
                        className="saved-preview"
                        onClick={() => openDoc(d)}
                      >
                        <div className="card-artwork">
                          <div className="poster-shadow">
                            <PopArtwork doc={d} />
                          </div>
                          <span className="template-hover-action">
                            編集する
                            <ArrowRight size={16} />
                          </span>
                          <span className="paper-tag">
                            {paperLabels[d.paper]}
                          </span>
                        </div>
                      </button>
                      <div className="card-meta">
                        <button
                          className="saved-name"
                          onClick={() => openDoc(d)}
                        >
                          <h3>{d.name}</h3>
                          <span>
                            {new Date(d.updatedAt).toLocaleDateString("ja-JP")}{" "}
                            更新
                          </span>
                        </button>
                        <div className="saved-actions">
                          <IconButton
                            label={`${d.name}を複製`}
                            onClick={() => duplicate(d)}
                          >
                            <Copy size={16} />
                          </IconButton>
                          <IconButton
                            label={`${d.name}を削除`}
                            onClick={() => {
                              setDeleteId(d.id);
                              setModal("delete");
                            }}
                          >
                            <Trash2 size={16} />
                          </IconButton>
                        </div>
                      </div>
                    </motion.article>
                  ))}
                </div>
              )}
              {((view === "templates" && !filtered.length) ||
                (view === "saved" && !filteredDocs.length)) && (
                <div className="empty-state">
                  <FolderOpen size={38} />
                  <h3>
                    {query
                      ? "一致するPOPがありません"
                      : view === "saved"
                        ? "保存したPOPはありません"
                        : "テンプレートがありません"}
                  </h3>
                  <p>
                    {query
                      ? "検索条件を変更してください"
                      : "テンプレートからPOPを作成して保存できます"}
                  </p>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setQuery("");
                      setCategory("すべて");
                      if (view === "saved") leave("templates");
                    }}
                  >
                    {query ? "検索をクリア" : "テンプレートを選ぶ"}
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
              <div className="library-footnote">
                <span>
                  <CheckCheck size={15} />
                  すべてのデザインを編集できます
                </span>
                <span>B5・B5 1/2・B5 1/4・B5 1/8対応</span>
              </div>
            </motion.main>
          ) : (
            <motion.main key="editor" className="editor-main" {...fade}>
              <div className="editor-heading">
                <div className="document-title">
                  <IconButton
                    label="テンプレートへ戻る"
                    onClick={() => leave("templates")}
                  >
                    <ArrowLeft size={19} />
                  </IconButton>
                  <div>
                    <input
                      aria-label="POPのファイル名"
                      value={doc.name}
                      maxLength={60}
                      onChange={(e) => patch({ name: e.target.value })}
                    />
                    <span>
                      <span className={`green-dot ${dirty ? "unsaved" : ""}`} />
                      {dirty
                        ? "未保存の変更"
                        : queueDraftId
                          ? "印刷待ちに保存済み"
                          : docs.some((d) => d.id === doc.id)
                            ? "下書き保存済み"
                            : "新しいPOP"}
                      <span className="title-separator">·</span>
                      {paperLabels[doc.paper]}{" "}
                      {doc.paper === "shelf"
                        ? ""
                        : doc.orientation === "landscape"
                          ? "横"
                          : "縦"}
                    </span>
                  </div>
                </div>
                <div className="editor-actions">
                  <div className="undo-actions">
                    <IconButton
                      label="元に戻す (Ctrl+Z)"
                      disabled={!history.length}
                      onClick={undo}
                    >
                      <Undo2 size={18} />
                    </IconButton>
                    <IconButton
                      label="やり直す (Ctrl+Shift+Z)"
                      disabled={!future.length}
                      onClick={redo}
                    >
                      <Redo2 size={18} />
                    </IconButton>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={save}
                    title="この端末の「保存したPOP」に残します (Ctrl+S)"
                  >
                    <Check size={17} />
                    下書き保存
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => setModal("print")}
                    title="印刷待ちに入れず、この商品だけを印刷します (Ctrl+P)"
                  >
                    <Printer size={17} />
                    この商品を印刷
                  </button>
                </div>
              </div>
              <div className="editor-workspace">
                <section className="canvas-section" aria-label="POPプレビュー">
                  <div className="canvas-toolbar">
                    <button
                      className="template-switch"
                      onClick={() => setModal("templates")}
                    >
                      <LayoutTemplate size={16} />
                      {templates.find((t) => t.id === doc.templateId)?.name ||
                        "カスタム"}
                      <ChevronDown size={14} />
                    </button>
                    <span className="preview-label">プレビュー</span>
                    <IconButton
                      label="画像を書き出す"
                      onClick={() => void exportPng()}
                    >
                      <ArrowDownToLine size={17} />
                    </IconButton>
                  </div>
                  <div
                    className={`canvas-area ${doc.orientation === "portrait" && !isB5Paper(doc.paper) ? "portrait-canvas" : ""}`}
                  >
                    <div className="canvas-ruler horizontal-ruler" />
                    <div className="canvas-ruler vertical-ruler" />
                    <motion.div
                      className={`artwork-wrapper ${doc.orientation === "portrait" && doc.paper !== "shelf" && !isB5Paper(doc.paper) ? "portrait-artwork" : ""}`}
                      animate={{ width: `${zoom}%` }}
                      transition={{
                        type: "spring",
                        stiffness: 220,
                        damping: 26,
                      }}
                    >
                      <div className="dimension-label">
                        {dimensions.width} × {dimensions.height} mm
                      </div>
                      <PopArtwork id="editor-artwork" doc={doc} />
                    </motion.div>
                  </div>
                  <div className="canvas-footer">
                    <span>
                      <ShieldCheck size={14} />
                      原寸印刷に対応
                    </span>
                    <div className="zoom-control">
                      <IconButton
                        label="縮小"
                        disabled={zoom <= 45}
                        onClick={() => setZoom((z) => Math.max(45, z - 10))}
                      >
                        <Minus size={15} />
                      </IconButton>
                      <button
                        onClick={() => setZoom(85)}
                        aria-label="ズームをリセット"
                      >
                        {zoom}%
                      </button>
                      <IconButton
                        label="拡大"
                        disabled={zoom >= 115}
                        onClick={() => setZoom((z) => Math.min(115, z + 10))}
                      >
                        <Plus size={15} />
                      </IconButton>
                      <span />
                      <IconButton
                        label="全体を表示"
                        onClick={() => setZoom(85)}
                      >
                        <Maximize size={15} />
                      </IconButton>
                    </div>
                  </div>
                </section>
                <aside className="properties-panel">
                  <div
                    className="panel-tabs"
                    role="tablist"
                    aria-label="編集パネル"
                  >
                    <button
                      role="tab"
                      aria-selected={panel === "product"}
                      className={panel === "product" ? "active" : ""}
                      onClick={() => setPanel("product")}
                    >
                      商品情報
                    </button>
                    <button
                      role="tab"
                      aria-selected={panel === "design"}
                      className={panel === "design" ? "active" : ""}
                      onClick={() => setPanel("design")}
                    >
                      デザイン
                    </button>
                  </div>
                  <div className="panel-scroll">
                    <AnimatePresence mode="wait">
                      {panel === "product" ? (
                        <motion.div key="product" {...fade}>
                          <div className="form-section">
                            <div className="form-section-title">
                              <span className="number-dot">1</span>
                              <h2>商品と価格</h2>
                              <button
                                className="ai-assist-button"
                                onClick={() => {
                                  setAiError("");
                                  setAiResult(null);
                                  setModal("ai");
                                }}
                              >
                                <Sparkles size={15} />
                                AIで入力
                              </button>
                            </div>
                            <Field label="商品名">
                              <input
                                ref={(node) => {
                                  productNameRef.current = node;
                                  if (node && focusProductRef.current) {
                                    node.focus();
                                    focusProductRef.current = false;
                                  }
                                }}
                                value={doc.productName}
                                maxLength={40}
                                placeholder="例：温州みかん"
                                onChange={(e) =>
                                  patch({ productName: e.target.value })
                                }
                              />
                            </Field>
                            <div className="field-pair">
                              <Field label="産地・メーカー">
                                <input
                                  value={doc.origin}
                                  maxLength={40}
                                  placeholder="例：愛媛県産"
                                  onChange={(e) =>
                                    patch({ origin: e.target.value })
                                  }
                                />
                              </Field>
                              <Field
                                label={
                                  doc.theme === "sale"
                                    ? "サイズ・容量"
                                    : "内容量・単位"
                                }
                              >
                                <input
                                  value={doc.unit}
                                  maxLength={30}
                                  placeholder="例：1袋（約500g）"
                                  onChange={(e) =>
                                    patch({ unit: e.target.value })
                                  }
                                />
                              </Field>
                            </div>
                            <Field label="本体価格（税抜）">
                              <div
                                className={`price-input ${!validPrint ? "invalid" : ""}`}
                              >
                                <input
                                  aria-label="本体価格（税抜）"
                                  type="text"
                                  inputMode="numeric"
                                  value={doc.price}
                                  maxLength={7}
                                  enterKeyHint="next"
                                  onKeyDown={(e) => {
                                    // Enter on the last required field finishes this product.
                                    if (
                                      e.key !== "Enter" ||
                                      e.nativeEvent.isComposing ||
                                      !canEnqueue
                                    )
                                      return;
                                    e.preventDefault();
                                    enqueue(true);
                                  }}
                                  onChange={(e) =>
                                    patch({
                                      price: e.target.value.replace(
                                        /[^0-9]/g,
                                        "",
                                      ),
                                    })
                                  }
                                />
                                <span>円</span>
                              </div>
                            </Field>
                            <div className="tax-line">
                              <Field label="消費税率">
                                <select
                                  value={doc.taxRate}
                                  onChange={(e) =>
                                    patch({
                                      taxRate: Number(e.target.value) as 8 | 10,
                                    })
                                  }
                                >
                                  <option value={8}>8%（軽減税率）</option>
                                  <option value={10}>10%</option>
                                </select>
                              </Field>
                            </div>
                            <div className="tax-summary">
                              <span>税込価格</span>
                              <strong>
                                {formatPrice(
                                  taxIncluded(
                                    doc.price,
                                    doc.taxRate,
                                    doc.taxRounding,
                                  ),
                                )}
                                <small>円</small>
                              </strong>
                            </div>
                          </div>
                          <div className="form-section">
                            <div className="form-section-title">
                              <span className="number-dot">2</span>
                              <h2>メモ・見出し</h2>
                            </div>
                            {doc.theme === "sale" && (
                              <>
                                <Field label="メモ1（青文字・価格の上）">
                                  <input
                                    value={doc.memo1 ?? ""}
                                    maxLength={40}
                                    placeholder="空欄で非表示"
                                    onChange={(e) =>
                                      patch({ memo1: e.target.value })
                                    }
                                  />
                                </Field>
                                <Field label="メモ2（黒文字・左側）">
                                  <input
                                    value={doc.memo2 ?? ""}
                                    maxLength={40}
                                    placeholder="空欄で非表示"
                                    onChange={(e) =>
                                      patch({ memo2: e.target.value })
                                    }
                                  />
                                </Field>
                              </>
                            )}
                            <Field label="見出しラベル">
                              <input
                                value={doc.badge}
                                maxLength={16}
                                placeholder="空欄で非表示"
                                onChange={(e) =>
                                  patch({ badge: e.target.value })
                                }
                              />
                            </Field>
                          </div>
                          {doc.theme !== "sale" && (
                            <>
                              <div className="form-section">
                                <div className="form-section-title">
                                  <span className="number-dot">3</span>
                                  <h2>商品画像</h2>
                                </div>
                                <button
                                  className="image-upload"
                                  onClick={() => fileRef.current?.click()}
                                >
                                  {doc.image ? (
                                    <img
                                      src={doc.image}
                                      alt="選択した商品画像"
                                    />
                                  ) : (
                                    <ImagePlus size={30} />
                                  )}
                                  <span>
                                    <strong>画像を変更</strong>
                                    <small>PNG・JPEG・WebP / 4MBまで</small>
                                  </span>
                                  <Upload size={16} />
                                </button>
                                {doc.image && (
                                  <button
                                    className="text-button remove-image"
                                    onClick={() => patch({ image: null })}
                                  >
                                    画像を非表示
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </motion.div>
                      ) : (
                        <motion.div key="design" {...fade}>
                          <div className="form-section">
                            <div className="form-section-title">
                              <SlidersHorizontal size={16} />
                              <h2>用紙とレイアウト</h2>
                            </div>
                            <p className="field-hint">
                              POPサイズは下の「POPサイズ」で変更します。
                            </p>
                            {doc.theme === "sale" && (
                              <p className="field-hint sale-format-note">
                                POPは横向きです。印刷用紙の向きと面付けはサイズに合わせます。
                              </p>
                            )}
                            {doc.paper !== "shelf" &&
                              !isB5Paper(doc.paper) &&
                              doc.theme !== "sale" && (
                                <Field label="用紙の向き">
                                  <div className="segmented-control">
                                    <button
                                      className={
                                        doc.orientation === "landscape"
                                          ? "active"
                                          : ""
                                      }
                                      onClick={() =>
                                        patch({ orientation: "landscape" })
                                      }
                                    >
                                      横向き
                                    </button>
                                    <button
                                      className={
                                        doc.orientation === "portrait"
                                          ? "active"
                                          : ""
                                      }
                                      onClick={() =>
                                        patch({ orientation: "portrait" })
                                      }
                                    >
                                      縦向き
                                    </button>
                                  </div>
                                </Field>
                              )}
                            <Field label="文字サイズ">
                              <div className="range-row">
                                <input
                                  aria-label="文字サイズ"
                                  type="range"
                                  min="0.7"
                                  max="1.2"
                                  step="0.05"
                                  value={doc.fontScale}
                                  onChange={(e) =>
                                    patch({ fontScale: Number(e.target.value) })
                                  }
                                />
                                <span>{Math.round(doc.fontScale * 100)}%</span>
                              </div>
                            </Field>
                          </div>
                          <div className="form-section">
                            <div className="form-section-title">
                              <h2>
                                {doc.theme === "sale"
                                  ? "価格・見出しの色"
                                  : "カラー"}
                              </h2>
                            </div>
                            <div className="color-palette">
                              {(doc.theme === "sale"
                                ? ["#ff0000", ...palette]
                                : palette
                              ).map((color) => (
                                <button
                                  key={color}
                                  aria-label={`カラー ${color}`}
                                  className={
                                    doc.color === color ? "selected" : ""
                                  }
                                  style={{ background: color }}
                                  onClick={() => patch({ color })}
                                >
                                  {doc.color === color && <Check size={17} />}
                                </button>
                              ))}
                              <label
                                className="custom-color"
                                title="カスタムカラー"
                              >
                                <Plus size={18} />
                                <input
                                  aria-label="カスタムカラー"
                                  type="color"
                                  value={doc.color}
                                  onChange={(e) =>
                                    patch({ color: e.target.value })
                                  }
                                />
                              </label>
                            </div>
                          </div>
                          <div className="form-section">
                            <div className="form-section-title">
                              <h2>価格の表示</h2>
                            </div>
                            <label className="toggle-row">
                              <span>税込価格を併記</span>
                              <input
                                type="checkbox"
                                role="switch"
                                checked={doc.showTax}
                                onChange={(e) =>
                                  patch({ showTax: e.target.checked })
                                }
                              />
                              <i />
                            </label>
                            <Field label="消費税の端数処理">
                              <select
                                value={doc.taxRounding}
                                onChange={(e) =>
                                  patch({
                                    taxRounding: e.target
                                      .value as PopDocument["taxRounding"],
                                  })
                                }
                              >
                                <option value="floor">切り捨て</option>
                                <option value="round">四捨五入</option>
                                <option value="ceil">切り上げ</option>
                              </select>
                            </Field>
                          </div>
                          <div className="form-section">
                            <div className="form-section-title">
                              <h2>データの書き出し</h2>
                            </div>
                            <button
                              className="secondary-button full-width"
                              onClick={downloadJson}
                            >
                              <FileDown size={16} />
                              編集用データ（JSON）
                            </button>
                            <button
                              className="secondary-button full-width mt-10"
                              onClick={() => void exportPng()}
                            >
                              <ImagePlus size={16} />
                              画像（PNG）
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {/* Fixed footer: the primary queue action stays reachable while the fields scroll. */}
                  <div className="continuous-entry">
                    <div className="continuous-entry-fields">
                      <Field label="POPサイズ">
                        <PaperSelect
                          value={doc.paper}
                          legacy={doc.theme !== "sale"}
                          onChange={(paper) =>
                            patch({
                              paper,
                              ...(isB5Paper(paper)
                                ? { orientation: "landscape" as const }
                                : {}),
                            })
                          }
                        />
                      </Field>
                      <Field label="POPの枚数">
                        <CopiesInput
                          aria-label="POPの枚数"
                          value={copies}
                          onChange={setCopies}
                        />
                      </Field>
                    </div>
                    {doc.theme === "sale" && !isB5Paper(doc.paper) ? (
                      <p className="field-hint">
                        以前のサイズです。印刷待ちにはB5のサイズを選んでください。
                      </p>
                    ) : null}
                    <button
                      className="primary-button full-width"
                      disabled={!canEnqueue}
                      onClick={() => enqueue(true)}
                    >
                      <Plus size={16} />
                      {queueDraftId ? "更新して次の商品" : "追加して次の商品"}
                      <ArrowRight size={16} />
                    </button>
                    <div className="continuous-entry-secondary">
                      <button
                        className="text-button"
                        title="印刷待ちに追加し、この商品の編集を続けます"
                        disabled={!canEnqueue}
                        onClick={() => enqueue(false)}
                      >
                        <Printer size={15} />
                        {queueDraftId ? "更新のみ" : "追加のみ"}
                      </button>
                      <button
                        className="text-button continuous-queue-link"
                        onClick={() => leave("queue")}
                      >
                        印刷待ち {queuePopCount}枚
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </aside>
              </div>
            </motion.main>
          )}
        </AnimatePresence>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden-input"
        aria-label="商品画像ファイル"
        onChange={(e) => void uploadImage(e)}
      />
      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        className="hidden-input"
        aria-label="POPデータファイル"
        onChange={(e) => void importJson(e)}
      />
      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            role="status"
            initial={{ opacity: 0, y: 25, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
          >
            <span>
              <Check size={16} />
            </span>
            {toast}
            <button aria-label="通知を閉じる" onClick={() => setToast("")}>
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modal && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !aiBusy) setModal(null);
            }}
          >
            <motion.div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              className={`modal ${modal === "templates" ? "wide-modal" : ""}`}
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
            >
              <div className="modal-heading">
                <div className="modal-title-icon">
                  {modal === "ai" ? (
                    <Sparkles size={20} />
                  ) : modal === "print" ? (
                    <Printer size={20} />
                  ) : modal === "help" ? (
                    <CircleHelp size={20} />
                  ) : modal === "delete" ? (
                    <Trash2 size={20} />
                  ) : modal === "discard" ? (
                    <Undo2 size={20} />
                  ) : (
                    <Settings2 size={20} />
                  )}
                </div>
                <h2 id="modal-title">
                  {modal === "ai"
                    ? "AIで商品情報を入力"
                    : modal === "print"
                      ? "印刷・PDF保存"
                      : modal === "settings"
                        ? "印刷設定"
                        : modal === "help"
                          ? "使い方・ショートカット"
                          : modal === "delete"
                            ? "POPを削除"
                            : modal === "discard"
                              ? "印刷待ちの編集"
                              : "テンプレートを変更"}
                </h2>
                <IconButton
                  label="閉じる"
                  onClick={() => {
                    aiController.current?.abort();
                    setModal(null);
                  }}
                >
                  <X size={19} />
                </IconButton>
              </div>
              {modal === "print" && (
                <>
                  <div className="print-modal-preview">
                    {singleSheets[0] ? (
                      <PrintSheetPreview sheet={singleSheets[0]} />
                    ) : (
                      <PopArtwork doc={doc} />
                    )}
                  </div>
                  <div className="print-details">
                    <span>
                      印刷用紙
                      <strong>
                        {isB5Paper(doc.paper) ? "B5" : paperLabels[doc.paper]}
                        {isB5Paper(doc.paper)
                          ? b5Layouts[doc.paper].orientation === "landscape"
                            ? "・横"
                            : "・縦"
                          : doc.paper === "shelf"
                            ? ""
                            : doc.orientation === "landscape"
                              ? "・横"
                              : "・縦"}
                      </strong>
                    </span>
                    <span>
                      POPの仕上がり
                      <strong>
                        {dimensions.width} × {dimensions.height} mm
                      </strong>
                    </span>
                  </div>
                  <p className="field-hint print-sheet-count">
                    POP {copies}枚 / 用紙 {singleSheets.length}枚
                    {singleSheets.length > 1 ? "（先頭ページを表示）" : ""}
                  </p>
                  <Field label="印刷するPOPの枚数">
                    <div className="copies-control">
                      <IconButton
                        label="印刷枚数を減らす"
                        disabled={copies <= 1}
                        onClick={() => setCopies((c) => c - 1)}
                      >
                        <Minus size={17} />
                      </IconButton>
                      <CopiesInput
                        aria-label="印刷枚数"
                        value={copies}
                        onChange={setCopies}
                      />
                      <IconButton
                        label="印刷枚数を増やす"
                        disabled={copies >= 20}
                        onClick={() => setCopies((c) => c + 1)}
                      >
                        <Plus size={17} />
                      </IconButton>
                      <span>枚</span>
                    </div>
                  </Field>
                  <div className="info-note">
                    <Printer size={16} />
                    <p>
                      印刷画面で倍率を「100%」、余白を「なし」、背景グラフィックを「オン」に設定してください。PDFは送信先から選択できます。
                    </p>
                  </div>
                  {!validPrint && (
                    <p className="error-text" role="alert">
                      商品名と正しい本体価格を入力してください。
                    </p>
                  )}
                  <button
                    className="primary-button full-width"
                    disabled={!validPrint}
                    onClick={() => {
                      const result = printDocument(doc, copies);
                      if (!result.ok)
                        notify(result.error || "印刷画面を開けませんでした");
                    }}
                  >
                    <Printer size={17} />
                    印刷画面を開く
                    <ArrowRight size={17} />
                  </button>
                </>
              )}
              {modal === "ai" && (
                <>
                  <p className="modal-description">
                    商品メモから商品名・産地・内容量・本体価格を抽出します。
                  </p>
                  <Field label="商品メモ">
                    <textarea
                      aria-label="商品メモ"
                      value={aiText}
                      maxLength={1000}
                      disabled={aiBusy}
                      onChange={(e) => {
                        setAiText(e.target.value);
                        setAiResult(null);
                        setAiError("");
                      }}
                      placeholder="例：愛媛県産 温州みかん 1袋（約500g） 本体価格398円"
                      rows={4}
                    />
                    <span className="textarea-count">
                      {aiText.length} / 1,000
                    </span>
                  </Field>
                  <div className="ai-privacy">
                    <ShieldCheck size={14} />
                    入力内容はCloudflare Workers AIへ送信されます
                  </div>
                  {aiReady === false && (
                    <p className="error-text">
                      AIに接続できません。接続状態を確認してください。
                    </p>
                  )}
                  {aiError && (
                    <div className="error-banner" role="alert">
                      {aiError}
                    </div>
                  )}
                  {aiResult && (
                    <div className="ai-results">
                      <h3>抽出結果を確認</h3>
                      {[
                        ["productName", "商品名"],
                        ["origin", "産地"],
                        ["unit", "内容量"],
                        ["price", "本体価格"],
                      ].map(([key, label]) => (
                        <div key={key}>
                          <span>{label}</span>
                          <strong>
                            {aiResult[key] === null
                              ? "記載なし"
                              : `${aiResult[key]}${key === "price" ? "円" : ""}`}
                          </strong>
                        </div>
                      ))}
                      <small>記載のない項目は現在の内容を保持します。</small>
                    </div>
                  )}
                  <button
                    className="primary-button full-width"
                    disabled={aiBusy || (!aiResult && !aiText.trim())}
                    onClick={aiResult ? applyAi : () => void runAi()}
                  >
                    {aiBusy ? (
                      <LoaderCircle size={17} className="spin" />
                    ) : aiResult ? (
                      <Check size={17} />
                    ) : (
                      <Sparkles size={17} />
                    )}{" "}
                    {aiBusy
                      ? "商品情報を抽出中"
                      : aiResult
                        ? "この内容を反映"
                        : "商品情報を抽出"}
                  </button>
                </>
              )}
              {modal === "settings" && (
                <>
                  <p className="modal-description">
                    新しいPOPに使う用紙サイズを設定します。
                  </p>
                  <Field label="既定のPOPサイズ">
                    <PaperSelect
                      label="既定のPOPサイズ"
                      value={size}
                      onChange={setSize}
                    />
                  </Field>
                  <div className="info-note">
                    <Printer size={17} />
                    <p>
                      WindowsのEdge・Chromeに対応。プリンター側も同じ用紙サイズ・原寸100%に設定してください。
                    </p>
                  </div>
                  <button
                    className="primary-button full-width"
                    onClick={() => {
                      try {
                        localStorage.setItem("pop-studio.paper.v1", size);
                        setModal(null);
                        notify("既定の用紙サイズを変更しました");
                      } catch {
                        notify("設定を保存できませんでした");
                      }
                    }}
                  >
                    <Check size={17} />
                    設定を保存
                  </button>
                </>
              )}
              {modal === "help" && (
                <>
                  <div className="help-steps">
                    {[
                      [
                        "1",
                        "デザインを選ぶ",
                        "カテゴリや用紙サイズでテンプレートを選択",
                      ],
                      [
                        "2",
                        "商品を続けて入力",
                        "「追加して次の商品」で印刷待ちにためる",
                      ],
                      [
                        "3",
                        "まとめて印刷",
                        "印刷待ちでB5の面付けを確認し、まとめて印刷",
                      ],
                    ].map(([n, title, text]) => (
                      <div key={n}>
                        <span className="number-dot">{n}</span>
                        <div>
                          <h3>{title}</h3>
                          <p>{text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="shortcut-list">
                    {[
                      ["追加して次の商品", "本体価格で Enter"],
                      ["下書き保存", "Ctrl + S"],
                      ["元に戻す", "Ctrl + Z"],
                      ["やり直す", "Ctrl + Shift + Z"],
                      ["印刷", "Ctrl + P"],
                      ["ダイアログを閉じる", "Esc"],
                    ].map(([l, k]) => (
                      <div key={l}>
                        <span>{l}</span>
                        <kbd>{k}</kbd>
                      </div>
                    ))}
                  </div>
                  <p className="storage-notice">
                    下書きと画像はこのブラウザに保存されます。データの移動・バックアップには編集用データ（JSON）を書き出してください。AIを実行した商品メモのみCloudflareに送信されます。
                  </p>
                </>
              )}
              {modal === "templates" && (
                <div className="modal-template-grid">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      className={doc.templateId === t.id ? "selected" : ""}
                      onClick={() => {
                        patch({
                          templateId: t.id,
                          theme: t.theme,
                          color: t.color,
                          ...(t.theme === "sale"
                            ? {
                                orientation: "landscape" as const,
                                paper: isB5Paper(doc.paper)
                                  ? doc.paper
                                  : ("B5" as const),
                                memo1: doc.memo1 ?? "",
                                memo2: doc.memo2 ?? "",
                              }
                            : {}),
                        });
                        setModal(null);
                      }}
                    >
                      <PopArtwork doc={createDocument(t)} />
                      <span>
                        {t.name}
                        {doc.templateId === t.id && <Check size={14} />}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {modal === "delete" && (
                <>
                  <p className="modal-description">
                    「{docs.find((d) => d.id === deleteId)?.name}
                    」をこの端末から削除します。この操作は取り消せません。
                  </p>
                  <div className="modal-action-row">
                    <button
                      className="secondary-button"
                      onClick={() => setModal(null)}
                    >
                      キャンセル
                    </button>
                    <button
                      className="danger-button"
                      onClick={() => {
                        if (persist(docs.filter((d) => d.id !== deleteId))) {
                          setModal(null);
                          notify("POPを削除しました");
                        }
                      }}
                    >
                      <Trash2 size={16} />
                      削除する
                    </button>
                  </div>
                </>
              )}
              {modal === "discard" && (
                <>
                  <p className="modal-description">
                    印刷待ちを更新するには、商品名と本体価格が必要です。変更を破棄すると、印刷待ちは編集前の内容のまま残ります。
                  </p>
                  <div className="modal-action-row">
                    <button
                      className="secondary-button"
                      onClick={() => {
                        setPendingLeave(null);
                        setModal(null);
                      }}
                    >
                      編集に戻る
                    </button>
                    <button
                      className="danger-button"
                      onClick={discardQueuedEdits}
                    >
                      <Undo2 size={16} />
                      変更を破棄して移動
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
function ArrowUpRight() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M6 18 18 6M6 6h12v12" />
    </svg>
  );
}
function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name.replace(/[<>:"/\\|?*]/g, "_");
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
