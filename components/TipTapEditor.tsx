"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { v4 as uuidv4 } from "uuid";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  ImageIcon,
} from "lucide-react";

interface TipTapEditorProps {
  content: object | null;
  onChange: (json: object) => void;
  placeholder?: string;
  userId?: string;
}

export default function TipTapEditor({
  content,
  onChange,
  placeholder = "Start writing...",
  userId,
}: TipTapEditorProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Placeholder.configure({ placeholder }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
    ],
    content: content && Object.keys(content).length > 0 ? content : undefined,
    onUpdate({ editor }) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange(editor.getJSON());
      }, 2000);
    },
    immediatelyRender: false,
  });

  // Update content when prop changes (switching entries)
  useEffect(() => {
    if (editor && content && Object.keys(content).length > 0) {
      const current = editor.getJSON();
      if (JSON.stringify(current) !== JSON.stringify(content)) {
        editor.commands.setContent(content);
      }
    }
  }, [editor, content]);

  const uploadImage = useCallback(
    async (file: File) => {
      if (!userId) return;
      const supabase = createClient();
      // For clipboard pastes the file name may be empty; derive ext from MIME type instead
      const mimeExt = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
      const nameExt = file.name ? (file.name.split(".").pop() ?? mimeExt) : mimeExt;
      const ext = nameExt || mimeExt;
      const path = `${userId}/${uuidv4()}.${ext}`;
      const { error } = await supabase.storage
        .from("journal-images")
        .upload(path, file);
      if (error) { console.error(error); return; }
      const { data } = supabase.storage
        .from("journal-images")
        .getPublicUrl(path);
      editor?.chain().focus().setImage({ src: data.publicUrl }).run();
    },
    [editor, userId]
  );

  // Paste handler
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) uploadImage(file).catch((err) => console.error("Image upload failed:", err));
          break;
        }
      }
    };
    dom.addEventListener("paste", handlePaste);
    return () => dom.removeEventListener("paste", handlePaste);
  }, [editor, uploadImage]);

  if (!editor) return null;

  const toolbarBtn = (
    active: boolean,
    onClick: () => void,
    children: React.ReactNode,
    title?: string
  ) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        background: active ? "#c9a84c22" : "none",
        border: active ? "1px solid #c9a84c" : "1px solid transparent",
        borderRadius: 6,
        color: active ? "#c9a84c" : "#888",
        padding: "4px 7px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
      }}
    >
      {children}
    </button>
  );

  return (
    <div
      style={{
        background: "#0a0a0a",
        border: "1px solid #222",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          padding: "8px 12px",
          borderBottom: "1px solid #222",
          background: "#111",
        }}
      >
        {toolbarBtn(
          editor.isActive("bold"),
          () => editor.chain().focus().toggleBold().run(),
          <Bold size={14} />,
          "Bold"
        )}
        {toolbarBtn(
          editor.isActive("italic"),
          () => editor.chain().focus().toggleItalic().run(),
          <Italic size={14} />,
          "Italic"
        )}
        {toolbarBtn(
          editor.isActive("underline"),
          () => editor.chain().focus().toggleUnderline().run(),
          <UnderlineIcon size={14} />,
          "Underline"
        )}
        <div style={{ width: 1, background: "#333", margin: "2px 4px" }} />
        {toolbarBtn(
          editor.isActive("heading", { level: 1 }),
          () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
          <Heading1 size={14} />,
          "H1"
        )}
        {toolbarBtn(
          editor.isActive("heading", { level: 2 }),
          () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          <Heading2 size={14} />,
          "H2"
        )}
        {toolbarBtn(
          editor.isActive("heading", { level: 3 }),
          () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
          <Heading3 size={14} />,
          "H3"
        )}
        <div style={{ width: 1, background: "#333", margin: "2px 4px" }} />
        {toolbarBtn(
          editor.isActive("bulletList"),
          () => editor.chain().focus().toggleBulletList().run(),
          <List size={14} />,
          "Bullet List"
        )}
        {toolbarBtn(
          editor.isActive("orderedList"),
          () => editor.chain().focus().toggleOrderedList().run(),
          <ListOrdered size={14} />,
          "Ordered List"
        )}
        {toolbarBtn(
          editor.isActive("blockquote"),
          () => editor.chain().focus().toggleBlockquote().run(),
          <Quote size={14} />,
          "Blockquote"
        )}
        <div style={{ width: 1, background: "#333", margin: "2px 4px" }} />
        {toolbarBtn(
          false,
          () => fileInputRef.current?.click(),
          <ImageIcon size={14} />,
          "Upload Image"
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadImage(file);
            e.target.value = "";
          }}
        />
      </div>

      {/* Editor content */}
      <div style={{ padding: "16px" }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
