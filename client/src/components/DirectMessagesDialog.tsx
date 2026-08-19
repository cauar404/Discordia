import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CallRoom } from "@/components/CallRoom";
import { LiveKitRoom } from "@livekit/components-react";
import { Loader2, MessageCircle, Paperclip, Pencil, Phone, Plus, Reply, Send, Smile, Trash2, UserPlus, Video, X } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";

type ActiveCall = { callId: number; serverUrl: string; token: string; kind: "voice" | "video" };

function initials(name?: string | null) {
  return name?.trim().slice(0, 1).toUpperCase() || "C";
}

function encodeFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

export function DirectMessagesDialog() {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [selectedPeople, setSelectedPeople] = useState<number[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [isSomeoneTyping, setIsSomeoneTyping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const callClosingRef = useRef<number | null>(null);

  const profile = trpc.platform.profile.me.useQuery(undefined, { enabled: open });
  const directs = trpc.social.directs.list.useQuery(undefined, { enabled: open });
  const people = trpc.social.people.list.useQuery(undefined, { enabled: open });
  const messages = trpc.social.directs.messages.useQuery({ conversationId: conversationId ?? 0 }, { enabled: Boolean(conversationId) });
  const callsConfigured = trpc.social.calls.configured.useQuery(undefined, { enabled: open });
  const activeCall = trpc.social.calls.active.useQuery({ conversationId: conversationId ?? 0 }, { enabled: open && Boolean(conversationId), retry: false });
  const create = trpc.social.directs.create.useMutation({
    onSuccess: async result => {
      await utils.social.directs.list.invalidate();
      setConversationId(result.conversationId);
      setNewConversationOpen(false);
      setSelectedPeople([]);
      setGroupTitle("");
      toast.success("Conversa privada criada.");
    },
    onError: error => toast.error(error.message),
  });
  const send = trpc.social.directs.send.useMutation({
    onSuccess: async () => {
      setDraft("");
      setFiles([]);
      setReplyTo(null);
      await utils.social.directs.messages.invalidate();
      await utils.social.directs.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const react = trpc.social.directs.react.useMutation({ onSuccess: () => utils.social.directs.messages.invalidate() });
  const update = trpc.social.directs.update.useMutation({ onSuccess: () => { setEditingId(null); void utils.social.directs.messages.invalidate(); }, onError: error => toast.error(error.message) });
  const remove = trpc.social.directs.remove.useMutation({ onSuccess: () => utils.social.directs.messages.invalidate(), onError: error => toast.error(error.message) });
  const markRead = trpc.social.directs.markRead.useMutation();
  const startCall = trpc.social.calls.start.useMutation();
  const joinCall = trpc.social.calls.join.useMutation();
  const leaveCall = trpc.social.calls.leave.useMutation();
  const endCall = trpc.social.calls.end.useMutation();
  const updateVoiceSettings = trpc.platform.settings.update.useMutation({ onSuccess: () => utils.platform.profile.me.invalidate(), onError: error => toast.error(error.message) });

  useEffect(() => {
    if (!conversationId && directs.data?.[0]) setConversationId(directs.data[0].conversation.id);
  }, [conversationId, directs.data]);

  useEffect(() => {
    const last = messages.data?.items.at(-1)?.message.id;
    if (conversationId && last) markRead.mutate({ conversationId, lastReadMessageId: last });
  }, [conversationId, messages.data?.items, markRead]);

  useEffect(() => {
    if (!open) return;
    const socket = io({ path: "/api/realtime", withCredentials: true });
    socketRef.current = socket;
    socket.on("connect", () => {
      if (conversationId) socket.emit("watch:direct", conversationId);
    });
    socket.on("typing:direct", (event: { conversationId?: number; userId?: number }) => {
      if (event.conversationId !== conversationId || event.userId === profile.data?.user.id) return;
      setIsSomeoneTyping(true);
      window.setTimeout(() => setIsSomeoneTyping(false), 1800);
    });
    socket.on("platform:refresh", () => { void utils.social.calls.active.invalidate(); });
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [conversationId, open, profile.data?.user.id]);

  const selected = directs.data?.find(item => item.conversation.id === conversationId)?.conversation;
  const label = selected?.title || (selected?.type === "group" ? "Grupo privado" : "Conversa direta");

  function chooseFiles(list: FileList | null) {
    if (!list) return;
    const selectedFiles = Array.from(list);
    if (selectedFiles.some(file => file.size > 10 * 1024 * 1024)) {
      toast.error("Cada anexo pode ter no máximo 10 MB.");
      return;
    }
    setFiles(current => [...current, ...selectedFiles].slice(0, 10));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!conversationId || (!draft.trim() && !files.length)) return;
    const uploads = await Promise.all(files.map(async file => ({ fileName: file.name, mimeType: file.type || "application/octet-stream", base64: await encodeFile(file) })));
    await send.mutateAsync({ conversationId, content: draft.trim(), files: uploads, replyToMessageId: replyTo });
  }

  function togglePerson(userId: number) {
    setSelectedPeople(current => current.includes(userId) ? current.filter(id => id !== userId) : [...current, userId].slice(0, 14));
  }

  async function beginCall(kind: "voice" | "video") {
    if (!conversationId) return;
    if (!callsConfigured.data) {
      toast.error("A infraestrutura de chamadas ainda não foi configurada.");
      return;
    }
    try {
      const created = await startCall.mutateAsync({ kind, conversationId });
      const credentials = await joinCall.mutateAsync({ callId: created.callId });
      setCall({ callId: credentials.call.id, serverUrl: credentials.serverUrl, token: credentials.token, kind: credentials.call.kind });
      await utils.social.calls.active.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar a chamada.");
    }
  }

  async function closeCall() {
    if (!call) return;
    const currentCall = call;
    if (!currentCall || callClosingRef.current === currentCall.callId) return;
    callClosingRef.current = currentCall.callId;
    setCall(null);
    try {
      await leaveCall.mutateAsync({ callId: currentCall.callId });
      await utils.social.calls.active.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar sua saída da chamada.");
    } finally {
      callClosingRef.current = null;
    }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><button className="dm-row w-full"><span className="grid size-7 place-items-center rounded-lg bg-[#cbb38a]/15 text-[#dec99d]"><MessageCircle className="size-4" /></span><span className="truncate">Mensagens diretas</span></button></DialogTrigger>
    <DialogContent className="border-white/10 bg-[#121722] p-0 text-white sm:max-w-5xl">
      <DialogHeader className="sr-only"><DialogTitle>Mensagens diretas</DialogTitle><DialogDescription>Conversas privadas do seu círculo.</DialogDescription></DialogHeader>
      <div className="grid min-h-[560px] grid-cols-[230px_minmax(0,1fr)]">
        <aside className="border-r border-white/10 bg-[#171c27] p-3">
          <div className="mb-4 flex items-center justify-between px-1"><span className="text-xs font-bold tracking-wider text-slate-400">CONVERSAS</span><button onClick={() => setNewConversationOpen(true)} title="Nova conversa" className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"><Plus className="size-4" /></button></div>
          <div className="space-y-1">{directs.isLoading && <Loader2 className="mx-auto mt-8 size-4 animate-spin text-slate-500" />}{(directs.data ?? []).map(({ conversation, membership }) => <button key={conversation.id} onClick={() => setConversationId(conversation.id)} className={cn("flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm", conversationId === conversation.id ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100")}><span className="grid size-7 place-items-center rounded-lg bg-[#cbb38a]/15 text-xs text-[#dec99d]">{initials(conversation.title || "D")}</span><span className="min-w-0 flex-1 truncate">{conversation.title || (conversation.type === "group" ? "Grupo privado" : "Conversa direta")}</span>{membership.lastReadMessageId === null && <span className="size-1.5 rounded-full bg-[#cbb38a]" />}</button>)}{!directs.isLoading && !(directs.data?.length) && <p className="px-2 py-4 text-xs leading-5 text-slate-500">Ainda não há conversas. Abra uma com um membro do círculo.</p>}</div>
        </aside>
        <section className="flex min-w-0 flex-col">
          <header className="flex h-14 items-center justify-between border-b border-white/10 px-5"><div className="flex items-center gap-2"><MessageCircle className="size-4 text-[#cbb38a]" /><strong className="text-sm">{label}</strong></div><div className="flex items-center gap-2"><button title={activeCall.data ? "Entrar na chamada de voz ativa" : "Iniciar chamada de voz"} onClick={() => beginCall("voice")} disabled={!conversationId} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40"><Phone className="size-4" /></button><button title={activeCall.data ? "Entrar na chamada de vídeo ativa" : "Iniciar chamada de vídeo"} onClick={() => beginCall("video")} disabled={!conversationId} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40"><Video className="size-4" /></button>{activeCall.data && <span className="rounded-full bg-rose-400/15 px-2 py-1 text-[10px] font-medium text-rose-200">ao vivo</span>}<span className="ml-1 text-[11px] text-slate-500">Privado</span></div></header>
          {!conversationId ? <div className="grid flex-1 place-items-center p-8 text-center"><div><MessageCircle className="mx-auto mb-3 size-8 text-[#cbb38a]" /><p className="text-sm text-slate-300">Selecione ou crie uma conversa privada.</p></div></div> : <><div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">{messages.isLoading ? <Loader2 className="mx-auto mt-12 size-5 animate-spin text-slate-500" /> : !(messages.data?.items.length) ? <div className="grid h-full place-items-center text-center"><div><MessageCircle className="mx-auto mb-3 size-8 text-[#cbb38a]" /><p className="text-sm text-slate-400">Esta conversa começa aqui.</p></div></div> : messages.data?.items.map(({ message, profile: author }) => { const reactions = (messages.data?.reactions ?? []).filter(reaction => reaction.directMessageId === message.id); return <article key={message.id} className="group flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#cbb38a] to-[#876e4b] text-sm font-semibold text-[#121720]">{initials(author.displayName)}</span><div className="min-w-0 flex-1"><div className="mb-1 flex items-center gap-2"><strong className="text-sm">{author.displayName}</strong><span className="text-[11px] text-slate-500">{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>{message.editedAt && <span className="text-[10px] text-slate-500">editada</span>}</div>{message.replyToMessageId && <p className="mb-1 text-xs text-slate-500">↳ resposta a uma mensagem anterior</p>}{editingId === message.id ? <form className="flex gap-2" onSubmit={event => { event.preventDefault(); update.mutate({ directMessageId: message.id, content: editingContent }); }}><Input value={editingContent} onChange={event => setEditingContent(event.target.value)} className="h-8 border-white/10 bg-white/5 text-white" /><Button size="sm" type="submit" className="h-8 bg-[#cbb38a] text-[#141820]">Salvar</Button></form> : <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{message.content}</p>}<div className="mt-1 flex flex-wrap gap-1">{reactions.map(reaction => <button key={reaction.id} onClick={() => react.mutate({ directMessageId: message.id, emoji: reaction.emoji })} className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-xs text-slate-300">{reaction.emoji}</button>)}</div><div className="mt-1 flex flex-wrap gap-2">{(messages.data?.attachments ?? []).filter(file => file.directMessageId === message.id).map(file => <a key={file.id} href={`/manus-storage/${file.storageKey}`} target="_blank" rel="noreferrer" className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-[#dfca9c] hover:bg-white/10">{file.fileName}</a>)}</div><div className="mt-2 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100"><button onClick={() => react.mutate({ directMessageId: message.id, emoji: "👍" })} className="text-[11px] text-slate-400 hover:text-white"><Smile className="mr-1 inline size-3" />Reagir</button><button onClick={() => setReplyTo(message.id)} className="text-[11px] text-slate-400 hover:text-white"><Reply className="mr-1 inline size-3" />Responder</button>{message.authorUserId === profile.data?.user.id && <><button onClick={() => { setEditingId(message.id); setEditingContent(message.content || ""); }} className="text-[11px] text-slate-400 hover:text-white"><Pencil className="mr-1 inline size-3" />Editar</button><button onClick={() => remove.mutate({ directMessageId: message.id })} className="text-[11px] text-slate-400 hover:text-rose-300"><Trash2 className="mr-1 inline size-3" />Excluir</button></>}</div></div></article>; })}</div><form onSubmit={submit} className="border-t border-white/10 p-4"><input ref={fileInputRef} type="file" multiple className="hidden" onChange={event => chooseFiles(event.target.files)} />{replyTo && <div className="mb-2 flex items-center justify-between rounded-lg bg-[#cbb38a]/10 px-3 py-2 text-xs text-[#dfca9c]">Respondendo a uma mensagem<button type="button" onClick={() => setReplyTo(null)}><X className="size-3.5" /></button></div>}{isSomeoneTyping && <p className="mb-2 text-xs text-slate-500">Alguém está digitando…</p>}<div className="flex items-end gap-2 rounded-xl bg-white/5 px-3 py-2"><button type="button" onClick={() => fileInputRef.current?.click()} className="text-slate-400 hover:text-white"><Paperclip className="size-4" /></button><Textarea rows={1} value={draft} onChange={event => { setDraft(event.target.value); if (conversationId) socketRef.current?.emit("typing:direct", conversationId); }} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(event); } }} placeholder={`Conversar em ${label}`} className="min-h-0 flex-1 resize-none border-0 bg-transparent p-0 text-sm text-white placeholder:text-slate-500 focus-visible:ring-0" /><Button type="submit" size="icon" disabled={(!draft.trim() && !files.length) || send.isPending} className="size-8 bg-[#cbb38a] text-[#141820]"><Send className="size-3.5" /></Button></div>{files.length > 0 && <p className="mt-2 text-[11px] text-slate-500">{files.length} anexo(s) pronto(s) para envio.</p>}</form></>}
        </section>
      </div>
      <Dialog open={newConversationOpen} onOpenChange={setNewConversationOpen}><DialogContent className="border-white/10 bg-[#171c27] text-white sm:max-w-sm"><DialogHeader><DialogTitle>Nova mensagem direta ou grupo</DialogTitle><DialogDescription className="text-slate-400">Selecione até 14 pessoas; duas pessoas formam uma conversa direta.</DialogDescription></DialogHeader><Input value={groupTitle} onChange={event => setGroupTitle(event.target.value)} placeholder="Nome do grupo (opcional)" className="border-white/10 bg-white/5 text-white" /><div className="max-h-64 space-y-1 overflow-y-auto">{(people.data ?? []).filter(person => person.userId !== profile.data?.user.id).map(person => <button key={person.userId} onClick={() => togglePerson(person.userId)} className={cn("flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left", selectedPeople.includes(person.userId) ? "bg-[#cbb38a]/15" : "hover:bg-white/5")}><span className="grid size-8 place-items-center rounded-lg bg-[#cbb38a]/15 text-sm text-[#dec99d]">{initials(person.displayName)}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{person.displayName}</strong><small className="text-xs text-slate-500">{person.customStatus || person.presence}</small></span>{selectedPeople.includes(person.userId) && <UserPlus className="size-4 text-[#dec99d]" />}</button>)}{people.isLoading && <Loader2 className="mx-auto my-6 size-4 animate-spin text-slate-500" />}</div><Button disabled={!selectedPeople.length || create.isPending} onClick={() => create.mutate({ participantUserIds: selectedPeople, title: selectedPeople.length > 1 && groupTitle.trim() ? groupTitle.trim() : null })} className="w-full bg-[#cbb38a] text-[#141820] hover:bg-[#dfca9c]">Criar conversa</Button></DialogContent></Dialog>
      {call && <div className="call-overlay"><LiveKitRoom token={call.token} serverUrl={call.serverUrl} connect audio video={call.kind === "video"} onDisconnected={() => void closeCall()}><CallRoom kind={call.kind} onLeave={closeCall} voiceVideoSettings={profile.data?.settings?.voiceVideo as Record<string, string | boolean> | undefined} onVoiceVideoSettingsChange={settings => updateVoiceSettings.mutateAsync({ voiceVideo: settings })} /></LiveKitRoom></div>}
    </DialogContent>
  </Dialog>;
}
