import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { realtimeConnectionOptions } from "@/lib/realtimeConnection";
import { io } from "socket.io-client";
import { Bell, ChevronDown, ChevronRight, Hash, Headphones, Info, Loader2, LockKeyhole, Maximize2, Mic, MicOff, MoreHorizontal, Phone, PhoneOff, Plus, Search, Send, Settings, ShieldCheck, Smile, Sparkles, Users, Video, Volume2, X } from "lucide-react";
import { FormEvent, lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type ActiveCall = { callId: number; channelId: number; serverUrl: string; token: string; kind: "voice" | "video" };
const CallOverlay = lazy(() => import("@/components/CallOverlay"));
const DirectMessagesDialog = lazy(() => import("@/components/DirectMessagesDialog").then(module => ({ default: module.DirectMessagesDialog })));
const CommunityAdminDialog = lazy(() => import("@/components/CommunityAdminDialog").then(module => ({ default: module.CommunityAdminDialog })));
const SocialHub = lazy(() => import("@/components/SocialHub").then(module => ({ default: module.SocialHub })));
const dots: Record<string, string> = { online: "bg-emerald-400", idle: "bg-amber-400", dnd: "bg-rose-400", invisible: "bg-slate-500", offline: "bg-slate-600" };

function Avatar({ name, className, avatarKey }: { name?: string | null; className?: string; avatarKey?: string | null }) {
  return <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-[14px] bg-gradient-to-br from-[#cbb38a] to-[#876e4b] font-semibold text-[#121720]", className)}>{avatarKey ? <img src={`/manus-storage/${avatarKey}`} alt="" className="size-full object-cover" /> : (name?.trim().slice(0, 1).toUpperCase() || "C")}</span>;
}

function MessageText({ content }: { content: string | null }) {
  const text = content ?? "";
  const link = text.match(/https?:\/\/[^\s]+/i)?.[0];
  let hostname = "Link compartilhado";
  try { if (link) hostname = new URL(link).hostname; } catch { hostname = "Link compartilhado"; }
  return <>{text && <p>{text}</p>}{link && <a className="link-preview" href={link} target="_blank" rel="noreferrer"><span>LINK COMPARTILHADO</span><strong>{hostname}</strong><small>{link}</small></a>}</>;
}

function ActiveCallBar({ minimized, microphoneEnabled, participantCount, participants, onRestore, onToggleMicrophone, onLeave }: { minimized: boolean; microphoneEnabled: boolean; participantCount: number; participants: Array<{ userId: number; displayName: string | null; avatarKey: string | null }>; onRestore: () => void; onToggleMicrophone: () => void; onLeave: () => void }) {
  return <aside className="active-call-bar" aria-label="Chamada em andamento"><button type="button" className="active-call-summary" onClick={onRestore}><span className="active-call-live" /><span className="min-w-0"><strong>Você está na chamada</strong><small>{participantCount} participante{participantCount === 1 ? "" : "s"} · {minimized ? "minimizada" : "em andamento"}</small></span>{participants.length > 0 && <span className="active-call-avatars" aria-label="Participantes atuais">{participants.slice(0, 3).map(participant => <Avatar key={participant.userId} name={participant.displayName} avatarKey={participant.avatarKey} className="size-5 border-2 border-[#161b27] text-[8px]" />)}</span>}<Maximize2 className="size-4" /></button><div className="active-call-actions"><button type="button" title={microphoneEnabled ? "Mutar microfone" : "Ativar microfone"} onClick={onToggleMicrophone}>{microphoneEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}</button><button type="button" className="is-leave" title="Sair da chamada" onClick={onLeave}><PhoneOff className="size-4" /></button></div></aside>;
}

function LoginScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const register = trpc.auth.register.useMutation({
    onSuccess: () => {
      toast.success("Conta criada. Bem-vindo ao Círculo.");
      window.location.assign("/");
    },
    onError: error => toast.error(error.message),
  });
  const login = trpc.auth.login.useMutation({
    onSuccess: () => {
      toast.success("Sessão iniciada. Bem-vindo de volta.");
      window.location.assign("/");
    },
    onError: error => toast.error(error.message),
  });
  const pending = register.isPending || login.isPending;
  const submitEntry = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password || (mode === "register" && !displayName.trim())) return;
    if (mode === "register") register.mutate({ displayName: displayName.trim(), email: email.trim(), password });
    else login.mutate({ email: email.trim(), password });
  };
  const canSubmit = email.trim() && password.length >= 10 && (mode === "login" || displayName.trim().length >= 2);
  return <main className="login-shell"><div className="login-orbit login-orbit-one" /><div className="login-orbit login-orbit-two" /><section className="login-card"><div className="brand-mark mx-auto mb-8"><span>C</span></div><p className="eyebrow">CÍRCULO</p><h1>{mode === "register" ? "Crie seu espaço." : "Onde o seu grupo realmente se encontra."}</h1><p className="login-copy">{mode === "register" ? "Use seu e-mail e uma senha para criar uma conta pessoal. Depois, crie sua comunidade ou entre em uma por convite." : "Entre na sua conta para conversar, participar de chamadas e acessar suas comunidades."}</p><div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-white/5 p-1"><button type="button" onClick={() => setMode("login")} className={cn("rounded-lg px-3 py-2 text-xs font-semibold transition", mode === "login" ? "bg-[#cbb38a] text-[#141820]" : "text-slate-400 hover:text-white")}>Entrar</button><button type="button" onClick={() => setMode("register")} className={cn("rounded-lg px-3 py-2 text-xs font-semibold transition", mode === "register" ? "bg-[#cbb38a] text-[#141820]" : "text-slate-400 hover:text-white")}>Criar conta</button></div><form className="mt-4 space-y-3" onSubmit={submitEntry}>{mode === "register" && <Input value={displayName} onChange={event => setDisplayName(event.target.value)} required minLength={2} maxLength={80} autoComplete="name" placeholder="Como quer ser chamado?" className="border-white/10 bg-white/5 text-center text-sm text-white placeholder:text-slate-500" />}<Input type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={320} autoComplete="email" placeholder="seu@email.com" className="border-white/10 bg-white/5 text-center text-sm text-white placeholder:text-slate-500" /><Input type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength={10} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Senha com pelo menos 10 caracteres" className="border-white/10 bg-white/5 text-center text-sm text-white placeholder:text-slate-500" /><Button type="submit" disabled={!canSubmit || pending} className="login-button w-full">{pending && <Loader2 className="size-4 animate-spin" />}{mode === "register" ? "Criar conta" : "Entrar no Círculo"} <ChevronRight className="size-4" /></Button></form><p className="login-note"><LockKeyhole className="size-3.5" /> Sua conta é individual. Comunidades continuam privadas e usam convites para novos membros.</p></section></main>;
}

function PendingApprovalScreen({ onRedeem, onLogout, pending }: { onRedeem: (code: string) => void; onLogout: () => void; pending: boolean }) {
  const [code, setCode] = useState("");
  return <main className="grid min-h-screen place-items-center bg-[#0e1118] px-6"><section className="max-w-md rounded-3xl border border-white/10 bg-[#171c27] p-8 text-center"><ShieldCheck className="mx-auto mb-4 size-9 text-[#cbb38a]" /><h1 className="text-xl font-semibold text-white">Acesso em aprovação</h1><p className="mt-3 text-sm leading-6 text-slate-400">Sua conta foi autenticada, mas ainda precisa receber um convite válido ou ser aprovada por um administrador.</p><form className="mt-6 space-y-3" onSubmit={event => { event.preventDefault(); if (code.trim()) onRedeem(code.trim()); }}><Input value={code} onChange={event => setCode(event.target.value)} placeholder="Cole o código de convite" className="border-white/10 bg-white/5 text-center text-white placeholder:text-slate-500" /><Button type="submit" disabled={!code.trim() || pending} className="w-full bg-[#cbb38a] text-[#141820] hover:bg-[#dfca9c]">{pending && <Loader2 className="size-4 animate-spin" />}Validar convite</Button></form><Button variant="outline" className="mt-3 border-white/10 bg-white/5 text-slate-200 hover:bg-white/10" onClick={onLogout}>Sair</Button></section></main>;
}

function BootstrapErrorScreen({ onRetry, onLogout }: { onRetry: () => void; onLogout: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-[#0e1118] px-6"><section className="max-w-md rounded-3xl border border-white/10 bg-[#171c27] p-8 text-center"><Info className="mx-auto mb-4 size-9 text-[#cbb38a]" /><h1 className="text-xl font-semibold text-white">Não foi possível abrir o seu espaço.</h1><p className="mt-3 text-sm leading-6 text-slate-400">A conexão com o Círculo demorou mais que o esperado. Você pode tentar novamente sem perder a sua conta.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Button onClick={onRetry} className="bg-[#cbb38a] text-[#141820] hover:bg-[#dfca9c]">Tentar novamente</Button><Button variant="outline" className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10" onClick={onLogout}>Sair</Button></div></section></main>;
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const utils = trpc.useUtils();
  const [communityId, setCommunityId] = useState<number | null>(null);
  const [channelId, setChannelId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [newCommunity, setNewCommunity] = useState(false);
  const [joinCommunityOpen, setJoinCommunityOpen] = useState(false);
  const [newChannel, setNewChannel] = useState(false);
  const [communityName, setCommunityName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [channelName, setChannelName] = useState("");
  const [channelType, setChannelType] = useState<"text" | "voice" | "announcement">("text");
  const [call, setCall] = useState<ActiveCall | null>(null);
  const [connectedChannelId, setConnectedChannelId] = useState<number | null>(null);
  const [callMinimized, setCallMinimized] = useState(false);
  const [callMicrophoneEnabled, setCallMicrophoneEnabled] = useState(true);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [microphoneToggleSignal, setMicrophoneToggleSignal] = useState(0);
  const [memberPaneOpen, setMemberPaneOpen] = useState(true);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [replyToMessageId, setReplyToMessageId] = useState<number | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [someoneTyping, setSomeoneTyping] = useState(false);
  const [pendingChatMessages, setPendingChatMessages] = useState<Array<{ id: string; channelId: number; content: string; attachmentNames: string[]; createdAt: number }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const realtimeRef = useRef<ReturnType<typeof io> | null>(null);
  const typingResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callClosingRef = useRef<number | null>(null);

  const profile = trpc.platform.profile.me.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const communities = trpc.platform.communities.list.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const channels = trpc.platform.communities.channels.useQuery({ communityId: communityId ?? 0 }, { enabled: Boolean(communityId) });
  const members = trpc.platform.communities.members.useQuery({ communityId: communityId ?? 0 }, { enabled: Boolean(communityId) });
  const messages = trpc.platform.messages.list.useQuery({ channelId: channelId ?? 0 }, { enabled: Boolean(channelId) });
  const notifications = trpc.social.notifications.list.useQuery(undefined, { enabled: isAuthenticated, staleTime: 30_000 });
  const callsConfigured = trpc.social.calls.configured.useQuery(undefined, { enabled: isAuthenticated, staleTime: 5 * 60_000 });
  const activeCall = trpc.social.calls.active.useQuery({ channelId: channelId ?? 0 }, { enabled: Boolean(channelId) && isAuthenticated, retry: false, refetchInterval: 8_000 });
  const voicePresence = trpc.social.calls.presenceByCommunity.useQuery({ communityId: communityId ?? 0 }, { enabled: Boolean(communityId) && isAuthenticated, retry: false, refetchInterval: 8_000 });
  const activeCallParticipants = activeCall.data?.participants ?? [];
  const isInCurrentCall = Boolean(call && connectedChannelId === channelId);
  const voiceParticipantsByChannel = useMemo(() => new Map((voicePresence.data ?? []).map(entry => [entry.channelId, entry.participants])), [voicePresence.data]);
  const channelPresenceParticipants = channelId ? voiceParticipantsByChannel.get(channelId) : undefined;
  const voiceRoomParticipants = channelPresenceParticipants?.length ? channelPresenceParticipants : activeCallParticipants;

  const createCommunity = trpc.platform.communities.create.useMutation({ onSuccess: async result => { await utils.platform.communities.list.invalidate(); setCommunityId(result.communityId); setNewCommunity(false); setCommunityName(""); toast.success("Comunidade privada criada."); }, onError: error => toast.error(error.message) });
  const createChannel = trpc.platform.communities.createChannel.useMutation({ onSuccess: async result => { await utils.platform.communities.channels.invalidate(); setChannelId(result.channelId); setNewChannel(false); setChannelName(""); toast.success("Canal criado."); }, onError: error => toast.error(error.message) });
  const send = trpc.platform.messages.send.useMutation({ onSuccess: async () => { setDraft(""); setPendingFiles([]); await utils.platform.messages.list.invalidate(); }, onError: error => toast.error(error.message) });
  const react = trpc.platform.messages.react.useMutation({ onSuccess: () => utils.platform.messages.list.invalidate() });
  const pinMessage = trpc.platform.messages.pin.useMutation({ onSuccess: () => utils.platform.messages.list.invalidate(), onError: error => toast.error(error.message) });
  const updateMessage = trpc.platform.messages.update.useMutation({ onSuccess: async () => { setDraft(""); setEditingMessageId(null); await utils.platform.messages.list.invalidate(); }, onError: error => toast.error(error.message) });
  const removeMessage = trpc.platform.messages.remove.useMutation({ onSuccess: () => { toast.success("Mensagem removida."); void utils.platform.messages.list.invalidate(); }, onError: error => toast.error(error.message) });
  const markRead = trpc.platform.messages.markRead.useMutation();
  const connectCall = trpc.social.calls.connect.useMutation();
  const leaveCall = trpc.social.calls.leave.useMutation();
  const endCall = trpc.social.calls.end.useMutation();
  const updateProfile = trpc.platform.profile.update.useMutation({ onSuccess: async () => { await utils.platform.profile.me.invalidate(); toast.success("Perfil atualizado."); }, onError: error => toast.error(error.message) });
  const updateSettings = trpc.platform.settings.update.useMutation({ onSuccess: async () => { await utils.platform.profile.me.invalidate(); toast.success("Configurações salvas."); }, onError: error => toast.error(error.message) });
  const createPermanentInvite = trpc.platform.communities.createPermanentInvite.useMutation({ onSuccess: result => { const link = `${window.location.origin}/?invite=${result.code}`; setInviteCode(link); void navigator.clipboard?.writeText(link); toast.success("Link permanente criado e copiado."); }, onError: error => toast.error(error.message) });
  const redeemInvite = trpc.platform.communities.redeemInvite.useMutation({ onSuccess: async () => { localStorage.removeItem("circulo-invite-code"); await utils.platform.profile.me.invalidate(); await utils.platform.communities.list.invalidate(); setJoinCode(""); setJoinCommunityOpen(false); toast.success("Convite aceito. Seu acesso foi liberado."); }, onError: error => { localStorage.removeItem("circulo-invite-code"); toast.error(error.message); } });

  useEffect(() => { const list = communities.data ?? []; if (!list.length) { if (communityId) setCommunityId(null); setChannelId(null); return; } if (!communityId || !list.some(item => item.community.id === communityId)) setCommunityId(list[0].community.id); }, [communities.data, communityId]);
  useEffect(() => { const code = new URLSearchParams(window.location.search).get("invite"); if (!code) return; localStorage.setItem("circulo-invite-code", code); window.history.replaceState({}, "", window.location.pathname); }, []);
  useEffect(() => { const last = messages.data?.items.at(-1)?.message; if (channelId && last) markRead.mutate({ channelId, lastReadMessageId: last.id }); }, [channelId, messages.data?.items, markRead]);
  useEffect(() => { if (!isAuthenticated || redeemInvite.isPending) return; const storedCode = localStorage.getItem("circulo-invite-code"); if (storedCode) redeemInvite.mutate({ code: storedCode }); }, [isAuthenticated]);
  useEffect(() => { const list = channels.data?.channels ?? []; if (!channelId && list[0]) setChannelId(list[0].id); if (channelId && !list.some(item => item.id === channelId)) setChannelId(list[0]?.id ?? null); }, [channels.data, channelId]);
  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = io(realtimeConnectionOptions);
    realtimeRef.current = socket;
    const refresh = (event: { type?: "channel" | "community" | "friendship" | "notification" | "call"; resource?: "channel" | "message"; channelId?: number } = {}) => {
      if (event.type === "channel") {
        if (event.resource === "channel") void utils.platform.communities.channels.invalidate();
        if (event.resource === "message" && event.channelId === channelId) void utils.platform.messages.list.invalidate();
        return;
      }
      if (event.type === "community") {
        void utils.platform.communities.list.invalidate();
        void utils.platform.communities.channels.invalidate();
        void utils.platform.communities.members.invalidate();
        return;
      }
      if (event.type === "call") {
        void utils.social.calls.active.invalidate();
        void utils.social.calls.presenceByCommunity.invalidate();
        return;
      }
      if (event.type === "notification" || event.type === "friendship") void utils.social.notifications.list.invalidate();
    };
    socket.on("platform:refresh", refresh);
    socket.on("typing:channel", (event: { channelId?: number; userId?: number }) => {
      if (event.channelId !== channelId || event.userId === user?.id) return;
      setSomeoneTyping(true);
      if (typingResetRef.current) clearTimeout(typingResetRef.current);
      typingResetRef.current = setTimeout(() => setSomeoneTyping(false), 1800);
    });
    return () => { if (typingResetRef.current) clearTimeout(typingResetRef.current); realtimeRef.current = null; socket.disconnect(); };
  }, [isAuthenticated, utils]);
  useEffect(() => { if (communityId) realtimeRef.current?.emit("watch:community", communityId); }, [communityId]);
  useEffect(() => { if (channelId) realtimeRef.current?.emit("watch:channel", channelId); setSomeoneTyping(false); setMobileNavigationOpen(false); }, [channelId]);
  useEffect(() => { if (call) realtimeRef.current?.emit("watch:call", call.callId); }, [call]);
  useEffect(() => {
    if (!call) return;
    const syncCallViewportHeight = () => {
      const visualHeight = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--circulo-call-viewport-height", `${Math.round(visualHeight)}px`);
    };
    const visualViewport = window.visualViewport;
    syncCallViewportHeight();
    window.addEventListener("resize", syncCallViewportHeight);
    visualViewport?.addEventListener("resize", syncCallViewportHeight);
    return () => {
      window.removeEventListener("resize", syncCallViewportHeight);
      visualViewport?.removeEventListener("resize", syncCallViewportHeight);
      document.documentElement.style.removeProperty("--circulo-call-viewport-height");
    };
  }, [call]);
  useEffect(() => {
    if (!channelId) return;
    const composer = document.querySelector<HTMLTextAreaElement>("textarea");
    const announceTyping = () => realtimeRef.current?.emit("typing:channel", channelId);
    composer?.addEventListener("input", announceTyping);
    return () => composer?.removeEventListener("input", announceTyping);
  }, [channelId]);
  useEffect(() => {
    const openPrivateAttachment = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>('a[href^="/manus-storage/"]');
      if (!link) return;
      event.preventDefault();
      const storageKey = decodeURIComponent(link.getAttribute("href")?.replace(/^\/manus-storage\//, "") ?? "");
      if (!storageKey) return;
      void utils.platform.messages.downloadAttachment.fetch({ storageKey })
        .then(result => window.open(result.url, "_blank", "noopener,noreferrer"))
        .catch(error => toast.error(error instanceof Error ? error.message : "Não foi possível abrir este anexo."));
    };
    document.addEventListener("click", openPrivateAttachment);
    return () => document.removeEventListener("click", openPrivateAttachment);
  }, [utils]);

  const activeChannel = channels.data?.channels.find(item => item.id === channelId) ?? null;
  const profileInfo = profile.data?.profile;
  const unread = notifications.data?.filter(item => !item.readAt).length ?? 0;
  const currentCommunity = communities.data?.find(item => item.community.id === communityId)?.community;
  const canManageCurrentCommunity = Boolean(currentCommunity && (currentCommunity.ownerUserId === user?.id || user?.role === "admin"));
  useEffect(() => {
    // A sala LiveKit permanece montada, mas deixa de ocupar a coluna do chat
    // ao navegar para outro canal. Isso evita dois painéis concorrendo pela
    // mesma célula da grade e preserva voz, vídeo e compartilhamento ativos.
    if (call && channelId !== call.channelId) setCallMinimized(true);
  }, [call, channelId]);
  const attachmentsByMessage = useMemo(() => {
    const grouped = new Map<number, NonNullable<typeof messages.data>["attachments"]>();
    messages.data?.attachments.forEach(file => grouped.set(file.messageId, [...(grouped.get(file.messageId) ?? []), file]));
    return grouped;
  }, [messages.data]);

  async function encodeFile(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.readAsDataURL(file);
    });
  }
  async function submit(event: FormEvent) { event.preventDefault(); if (editingMessageId) { if (draft.trim()) await updateMessage.mutateAsync({ messageId: editingMessageId, content: draft.trim() }); return; } if (channelId && (draft.trim() || pendingFiles.length) && activeChannel?.type !== "voice") { const previousDraft = draft; const previousFiles = pendingFiles; const previousReply = replyToMessageId; const pendingId = crypto.randomUUID(); setPendingChatMessages(current => [...current, { id: pendingId, channelId, content: previousDraft.trim(), attachmentNames: previousFiles.map(file => file.name), createdAt: Date.now() }]); setDraft(""); setPendingFiles([]); setReplyToMessageId(null); try { const files = await Promise.all(previousFiles.map(async file => ({ fileName: file.name, mimeType: file.type || "application/octet-stream", base64: await encodeFile(file) }))); await send.mutateAsync({ channelId, content: previousDraft.trim(), replyToMessageId: previousReply, files }); setPendingChatMessages(current => current.filter(message => message.id !== pendingId)); } catch { setPendingChatMessages(current => current.filter(message => message.id !== pendingId)); setDraft(previousDraft); setPendingFiles(previousFiles); setReplyToMessageId(previousReply); } } }
  function chooseFiles(files: FileList | null) { if (!files) return; const selected = Array.from(files); if (selected.some(file => file.size > 10 * 1024 * 1024)) { toast.error("Cada anexo pode ter no máximo 10 MB."); return; } setPendingFiles(current => [...current, ...selected].slice(0, 10)); }
  async function beginCall(kind: "voice" | "video") {
    if (!channelId) return;
    if (!callsConfigured.data) { toast.error("A infraestrutura de chamadas ainda não foi configurada."); return; }
    try { const credentials = await connectCall.mutateAsync({ kind, channelId }); setCallMinimized(false); setCallMicrophoneEnabled(true); setConnectedChannelId(channelId); setCall({ callId: credentials.call.id, channelId, serverUrl: credentials.serverUrl, token: credentials.token, kind: credentials.call.kind }); await utils.social.calls.active.invalidate(); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível iniciar a chamada."); }
  }
  async function closeCall() { const currentCall = call; if (!currentCall || callClosingRef.current === currentCall.callId) return; callClosingRef.current = currentCall.callId; setCall(null); setConnectedChannelId(null); setCallMinimized(false); setCallMicrophoneEnabled(true); try { await leaveCall.mutateAsync({ callId: currentCall.callId }); await utils.social.calls.active.invalidate(); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível registrar sua saída da chamada."); } finally { callClosingRef.current = null; } }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#0e1118]"><Loader2 className="size-6 animate-spin text-[#cbb38a]" /></main>;
  if (!isAuthenticated) return <LoginScreen />;
  if (profile.error || communities.error) return <BootstrapErrorScreen onRetry={() => { void profile.refetch(); void communities.refetch(); }} onLogout={() => { void logout(); }} />;
  if (profile.isLoading || communities.isLoading) return <main className="grid min-h-screen place-items-center bg-[#0e1118]"><div className="flex items-center gap-3 text-sm text-slate-400"><Loader2 className="size-4 animate-spin text-[#cbb38a]" /> Preparando o seu espaço…</div></main>;
  if (redeemInvite.isPending) return <main className="grid min-h-screen place-items-center bg-[#0e1118]"><div className="flex items-center gap-3 text-sm text-slate-400"><Loader2 className="size-4 animate-spin text-[#cbb38a]" /> Validando convite privado…</div></main>;
  if (profile.error) return <LoginScreen />;

  return <main className={cn("app-shell", call && !callMinimized && "call-active")} data-liquid-surface="workspace">
    <button type="button" className={cn("mobile-nav-trigger", mobileNavigationOpen && "is-open")} aria-label={mobileNavigationOpen ? "Fechar canais" : "Abrir canais"} aria-expanded={mobileNavigationOpen} onClick={() => setMobileNavigationOpen(current => !current)}><Hash className="size-4" /><span>Canais</span></button>
    <aside className="workspace-rail" aria-label="Comunidades"><button className="brand-mark" aria-label="Círculo"><span>C</span></button><div className="rail-rule" /><div className="rail-stack">{(communities.data ?? []).map(({ community }) => <button key={community.id} className={cn("rail-community", communityId === community.id && "is-active")} onClick={() => setCommunityId(community.id)} title={community.name}><Avatar name={community.name} className="size-10 text-sm" /></button>)}<Dialog open={newCommunity} onOpenChange={setNewCommunity}><DialogTrigger asChild><button className="rail-add" aria-label="Criar comunidade" title="Criar comunidade"><Plus className="size-5" /></button></DialogTrigger><DialogContent className="border-white/10 bg-[#171c27] text-white sm:max-w-md"><DialogHeader><DialogTitle>Nova comunidade privada</DialogTitle><DialogDescription className="text-slate-400">Crie um espaço fechado para o seu grupo.</DialogDescription></DialogHeader><form onSubmit={event => { event.preventDefault(); createCommunity.mutate({ name: communityName }); }} className="space-y-4"><Input autoFocus required placeholder="Nome da comunidade" value={communityName} onChange={event => setCommunityName(event.target.value)} className="border-white/10 bg-white/5 text-white placeholder:text-slate-500" /><DialogFooter><Button type="submit" disabled={createCommunity.isPending} className="bg-[#cbb38a] text-[#141820] hover:bg-[#dfca9c]">{createCommunity.isPending && <Loader2 className="size-4 animate-spin" />}Criar comunidade</Button></DialogFooter></form></DialogContent></Dialog><Dialog open={joinCommunityOpen} onOpenChange={setJoinCommunityOpen}><DialogTrigger asChild><button className="rail-add" aria-label="Entrar em comunidade" title="Entrar com convite"><ChevronRight className="size-5" /></button></DialogTrigger><DialogContent className="border-white/10 bg-[#171c27] text-white sm:max-w-md"><DialogHeader><DialogTitle>Entrar em comunidade</DialogTitle><DialogDescription className="text-slate-400">Cole o código enviado por quem administra a comunidade.</DialogDescription></DialogHeader><form onSubmit={event => { event.preventDefault(); if (joinCode.trim()) redeemInvite.mutate({ code: joinCode.trim() }); }} className="space-y-4"><Input autoFocus required minLength={8} maxLength={128} value={joinCode} onChange={event => setJoinCode(event.target.value)} placeholder="Código de convite" className="border-white/10 bg-white/5 text-white placeholder:text-slate-500" /><DialogFooter><Button type="submit" disabled={!joinCode.trim() || redeemInvite.isPending} className="bg-[#cbb38a] text-[#141820] hover:bg-[#dfca9c]">{redeemInvite.isPending && <Loader2 className="size-4 animate-spin" />}Entrar</Button></DialogFooter></form></DialogContent></Dialog></div><div className="mt-auto pb-4"><button className="rail-secondary" title="Comunidades privadas"><LockKeyhole className="size-4" /></button></div></aside>

    <aside className={cn("channel-sidebar", mobileNavigationOpen && "is-mobile-open")}><header className="community-header"><button className="flex min-w-0 flex-1 items-center gap-2 text-left"><span className="truncate font-semibold text-white">{currentCommunity?.name ?? "Seu Círculo"}</span><ChevronDown className="ml-auto size-4 text-slate-400" /></button>{communityId && <Suspense fallback={null}><CommunityAdminDialog communityId={communityId} channelId={channelId} enabled={canManageCurrentCommunity} canDelete={canManageCurrentCommunity} triggerLabel="Gerenciar" triggerClassName="community-admin-access" /></Suspense>}<Dialog open={inviteOpen} onOpenChange={setInviteOpen}><DialogTrigger asChild><button title="Gerar link de convite" className="text-slate-500 hover:text-slate-200"><MoreHorizontal className="size-4" /></button></DialogTrigger><DialogContent className="border-white/10 bg-[#171c27] text-white sm:max-w-md"><DialogHeader><DialogTitle>Link de convite permanente</DialogTitle><DialogDescription className="text-slate-400">Um clique cria um link sem prazo ou limite de entradas. Você poderá revogá-lo na administração da comunidade.</DialogDescription></DialogHeader><div className="space-y-4"><Button type="button" disabled={!communityId || createPermanentInvite.isPending} onClick={() => communityId && createPermanentInvite.mutate({ communityId })} className="w-full bg-[#cbb38a] text-[#141820] hover:bg-[#dfca9c]">{createPermanentInvite.isPending && <Loader2 className="size-4 animate-spin" />}Gerar link permanente</Button>{inviteCode && <div className="rounded-xl border border-[#cbb38a]/25 bg-[#cbb38a]/10 p-3"><p className="text-[10px] font-bold tracking-wider text-[#ddcaa4]">LINK ATIVO</p><code className="mt-1 block break-all text-sm text-white">{inviteCode}</code></div>}</div></DialogContent></Dialog></header>{communityId ? <><div className="channel-scroll"><div className="section-heading"><ChevronDown className="size-3.5" /> CANAIS <Dialog open={newChannel} onOpenChange={setNewChannel}><DialogTrigger asChild><button aria-label="Criar canal" className="ml-auto text-slate-500 hover:text-white"><Plus className="size-4" /></button></DialogTrigger><DialogContent className="border-white/10 bg-[#171c27] text-white sm:max-w-md"><DialogHeader><DialogTitle>Novo canal</DialogTitle><DialogDescription className="text-slate-400">Escolha o formato da nova sala.</DialogDescription></DialogHeader><form onSubmit={event => { event.preventDefault(); if (communityId) createChannel.mutate({ communityId, name: channelName, type: channelType }); }} className="space-y-4"><Input autoFocus required placeholder="nome-do-canal" value={channelName} onChange={event => setChannelName(event.target.value.toLowerCase().replace(/\s+/g, "-"))} className="border-white/10 bg-white/5 text-white placeholder:text-slate-500" /><div className="grid grid-cols-3 gap-2">{(["text", "voice", "announcement"] as const).map(type => <button type="button" key={type} onClick={() => setChannelType(type)} className={cn("rounded-xl border px-2 py-2 text-xs", channelType === type ? "border-[#cbb38a] bg-[#cbb38a]/10 text-[#e8d9b9]" : "border-white/10 text-slate-400")}>{type === "text" ? "Texto" : type === "voice" ? "Voz" : "Anúncio"}</button>)}</div><DialogFooter><Button type="submit" disabled={createChannel.isPending} className="bg-[#cbb38a] text-[#141820] hover:bg-[#dfca9c]">Criar canal</Button></DialogFooter></form></DialogContent></Dialog></div>{channels.isLoading ? <div className="px-3 py-4 text-xs text-slate-500">Carregando canais…</div> : (channels.data?.channels ?? []).map(channel => { const participants = channel.type === "voice" ? voiceParticipantsByChannel.get(channel.id) ?? [] : []; return <div key={channel.id} className={cn("voice-channel-group", participants.length > 0 && "has-participants")}><button onClick={() => setChannelId(channel.id)} className={cn("channel-row", channelId === channel.id && "is-active", connectedChannelId === channel.id && "is-connected")}><span>{channel.type === "voice" ? <Volume2 className="size-4" /> : channel.type === "announcement" ? <Bell className="size-4" /> : <Hash className="size-4" />}</span><span className="truncate">{channel.name}</span>{participants.length > 0 && <span className="channel-participant-count">{participants.length}</span>}</button>{participants.map(participant => <button type="button" key={`${channel.id}-${participant.userId}`} onClick={() => setChannelId(channel.id)} className="voice-channel-participant" title={`${participant.displayName || "Membro"} está na chamada`}><span className="presence-wrap"><Avatar name={participant.displayName || "Membro"} avatarKey={participant.avatarKey} className="size-5 rounded-md text-[9px]" /><i className="presence-dot bg-emerald-400" /></span><span className="truncate">{participant.displayName || "Membro"}</span></button>)}</div>; })}{!channels.isLoading && !(channels.data?.channels.length) && <div className="empty-side-state">Crie o primeiro canal para começar.</div>}<div className="section-heading mt-7"><ChevronRight className="size-3.5" /> MENSAGENS DIRETAS</div><Suspense fallback={null}><DirectMessagesDialog /></Suspense></div><footer className="account-strip"><span className="presence-wrap"><Avatar name={profileInfo?.displayName ?? user?.name} avatarKey={profileInfo?.avatarKey} className="size-8 text-xs" /><i className={cn("presence-dot", dots[profileInfo?.presence ?? "offline"])} /></span><div className="min-w-0"><strong>{profileInfo?.displayName ?? user?.name ?? "Membro"}</strong><span>{profileInfo?.customStatus || "disponível"}</span></div><button title="Configurações" onClick={() => setAccountOpen(true)}><Settings className="size-4" /></button></footer></> : <div className="sidebar-empty"><Sparkles className="size-5 text-[#cbb38a]" /><p>Crie a primeira comunidade privada do seu círculo.</p></div>}</aside>

    <section className="chat-panel"><header className="chat-header"><div className="flex min-w-0 items-center gap-2"><Hash className="size-5 text-slate-500" /><strong className="truncate text-[15px] text-white">{activeChannel?.name ?? "Boas-vindas"}</strong></div><div className="header-actions"><Suspense fallback={null}><SocialHub communityId={communityId} communityOwnerUserId={currentCommunity?.ownerUserId} /></Suspense><button onClick={() => setMemberPaneOpen(!memberPaneOpen)} title="Membros"><Users className="size-[18px]" /></button><button title="Buscar"><Search className="size-[18px]" /></button></div></header>{!communityId ? <section className="empty-main"><div className="empty-orb"><Users className="size-7" /></div><p className="eyebrow">COMECE COM O SEU GRUPO</p><h1>Seu espaço privado começa aqui.</h1><p>Crie uma comunidade e convide as pessoas certas para conversar e entrar em chamada.</p><Button onClick={() => setNewCommunity(true)} className="bg-[#cbb38a] text-[#141820] hover:bg-[#dfca9c]"><Plus className="size-4" />Criar comunidade</Button></section> : activeChannel?.type === "voice" ? <section className="voice-room"><div className="voice-aurora" /><div className="relative z-10 max-w-lg text-center"><div className="mx-auto mb-6 grid size-20 place-items-center rounded-[28px] border border-[#cbb38a]/30 bg-[#cbb38a]/10 text-[#e6d2a9]"><Volume2 className="size-9" /></div><p className="eyebrow">SALA DE VOZ</p><h1>{activeChannel.name}</h1><p>{activeCall.data ? "Uma chamada está em andamento. Entre para falar com o grupo." : "Entre para falar com os membros desta comunidade."}</p>{voiceRoomParticipants.length > 0 && <div className="voice-room-presence" aria-live="polite"><div className="voice-room-presence-heading"><span className="voice-room-live-dot" />{voiceRoomParticipants.length === 1 ? "1 pessoa na chamada" : `${voiceRoomParticipants.length} pessoas na chamada`}</div><div className="voice-room-participants">{voiceRoomParticipants.map(participant => <div key={participant.userId} className="voice-room-participant"><span className="presence-wrap"><Avatar name={participant.displayName || "Membro"} avatarKey={participant.avatarKey} className="size-9 rounded-xl text-sm" /><i className="presence-dot bg-emerald-400" /></span><span>{participant.displayName || "Membro"}</span></div>)}</div></div>}<div className="mt-7 flex flex-wrap justify-center gap-3"><Button className="bg-[#cbb38a] text-[#141820] hover:bg-[#dfca9c]" onClick={() => beginCall("voice")}><Headphones className="size-4" />{activeCall.data ? "Entrar na chamada" : "Entrar por voz"}</Button><Button variant="outline" className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10" onClick={() => beginCall("video")}><Video className="size-4" />{activeCall.data ? "Entrar com vídeo" : "Iniciar vídeo"}</Button></div>{!callsConfigured.data && <p className="mt-5 text-xs text-amber-200/70">As chamadas aguardam a configuração do provedor.</p>}</div></section> : <><div className="messages-scroll">{messages.isLoading ? <div className="grid h-full place-items-center"><Loader2 className="size-5 animate-spin text-slate-500" /></div> : !(messages.data?.items.length) ? <div className="message-empty"><div className="empty-channel-icon"><Hash className="size-7" /></div><h1>Este é o começo de #{activeChannel?.name ?? "canal"}.</h1><p>Envie uma mensagem para abrir a conversa.</p></div> : messages.data?.items.map(({ message, profile: author }) => <article key={message.id} className="message-row"><Avatar name={author.displayName} className="mt-0.5 size-9 text-sm" /><div className="min-w-0 flex-1"><div className="message-meta"><strong>{author.displayName}</strong><span>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>{message.editedAt && <em>editada</em>}{message.isPinned && <em>fixada</em>}</div>{message.replyToMessageId && <p className="mb-1 text-xs text-slate-500">↳ resposta a uma mensagem anterior</p>}<p>{message.content}</p>{(attachmentsByMessage.get(message.id) ?? []).map(file => <a key={file.id} className="attachment-link" href={`/manus-storage/${file.storageKey}`} target="_blank" rel="noreferrer">{file.fileName}</a>)}<div className="message-tools"><button onClick={() => react.mutate({ messageId: message.id, emoji: "👍" })}><Smile className="size-3.5" /> Reagir</button><button onClick={() => setReplyToMessageId(message.id)}>Responder</button>{message.authorUserId === user?.id && <button onClick={() => { setEditingMessageId(message.id); setReplyToMessageId(null); setDraft(message.content ?? ""); }}>Editar</button>}<button onClick={() => removeMessage.mutate({ messageId: message.id })}>Excluir</button><button onClick={() => pinMessage.mutate({ messageId: message.id, pinned: !message.isPinned })}>{message.isPinned ? "Desafixar" : "Fixar"}</button></div></div></article>)}</div>{(replyToMessageId || editingMessageId) && <div className="mx-4 rounded-t-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-400"><span>{editingMessageId ? "Editando mensagem" : "Respondendo a uma mensagem"}</span><button type="button" className="ml-3 text-[#e4d2ad]" onClick={() => { setReplyToMessageId(null); setEditingMessageId(null); setDraft(""); }}>Cancelar</button></div>}<form className="composer-wrap" onSubmit={submit}><input ref={fileInputRef} type="file" className="hidden" multiple onChange={event => chooseFiles(event.target.files)} /><div className="composer"><button type="button" title="Anexar" onClick={() => fileInputRef.current?.click()}><Plus className="size-5" /></button><Textarea value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(event); } }} placeholder={editingMessageId ? "Editar mensagem" : `Conversar em #${activeChannel?.name ?? "canal"}`} className="min-h-0 flex-1 resize-none border-0 bg-transparent p-0 text-[15px] text-white placeholder:text-slate-500 focus-visible:ring-0" rows={1} /><div className="composer-actions"><span className="text-[10px]">{pendingFiles.length ? `${pendingFiles.length} anexo(s)` : ""}</span><button type="button" title="Emoji"><Smile className="size-[18px]" /></button><Button type="submit" size="icon" disabled={(!draft.trim() && !pendingFiles.length) || send.isPending} className="size-8 rounded-lg bg-[#cbb38a] text-[#141820] hover:bg-[#dfca9c]"><Send className="size-3.5" /></Button></div></div></form></>}</section>

    <aside className={cn("context-panel", !memberPaneOpen && "is-closed")}><div className="context-title"><span>MEMBROS — {members.data?.length ?? 0}</span><button onClick={() => setMemberPaneOpen(false)}><X className="size-4" /></button></div><div className="member-list">{members.data?.map(({ member, profile: memberProfile }) => <button key={member.id} className="member-row"><span className="presence-wrap"><Avatar name={memberProfile.displayName} className="size-8 text-xs" /><i className={cn("presence-dot", dots[memberProfile.presence])} /></span><span className="min-w-0"><strong>{member.nickname || memberProfile.displayName}</strong><small>{memberProfile.customStatus || memberProfile.presence}</small></span></button>)}</div><div className="context-card"><Info className="size-4 text-[#cbb38a]" /><p>As conversas deste espaço são privadas para os membros da comunidade.</p></div></aside>
    <Dialog open={accountOpen} onOpenChange={setAccountOpen}><DialogContent className="border-white/10 bg-[#171c27] text-white sm:max-w-lg"><DialogHeader><DialogTitle>Conta e preferências</DialogTitle><DialogDescription className="text-slate-400">Atualize seu perfil, presença, privacidade e notificações.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={async event => { event.preventDefault(); const form = new FormData(event.currentTarget); const avatarFile = form.get("avatar") instanceof File ? form.get("avatar") as File : null; if (avatarFile?.size && avatarFile.size > 2 * 1024 * 1024) { toast.error("O avatar pode ter no máximo 2 MB."); return; } const avatar = avatarFile?.size ? { fileName: avatarFile.name, mimeType: avatarFile.type, base64: await encodeFile(avatarFile) } : undefined; await updateProfile.mutateAsync({ displayName: String(form.get("displayName") || ""), bio: String(form.get("bio") || "") || null, customStatus: String(form.get("status") || "") || null, avatar }); }}><div className="flex items-center gap-3"><Avatar name={profileInfo?.displayName ?? user?.name} avatarKey={profileInfo?.avatarKey} className="size-12 text-lg" /><div><Input ref={avatarInputRef} name="avatar" type="file" accept="image/png,image/jpeg,image/webp" className="border-white/10 bg-white/5 text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-[#cbb38a] file:px-2 file:py-1 file:text-xs file:font-medium file:text-[#141820]" /><p className="mt-1 text-[10px] text-slate-500">PNG, JPEG ou WebP, até 2 MB.</p></div></div><Input name="displayName" defaultValue={profileInfo?.displayName ?? ""} placeholder="Nome de exibição" className="border-white/10 bg-white/5 text-white" /><Textarea name="bio" defaultValue={profileInfo?.bio ?? ""} placeholder="Bio" className="border-white/10 bg-white/5 text-white" /><Input name="status" defaultValue={profileInfo?.customStatus ?? ""} placeholder="Status personalizado" className="border-white/10 bg-white/5 text-white" /><div className="grid grid-cols-4 gap-2">{(["online", "idle", "dnd", "invisible"] as const).map(value => <button key={value} type="button" onClick={() => updateProfile.mutate({ presence: value })} className={cn("rounded-lg border px-2 py-2 text-xs", profileInfo?.presence === value ? "border-[#cbb38a] text-[#e4d2ad]" : "border-white/10 text-slate-400")}>{value === "online" ? "Online" : value === "idle" ? "Ausente" : value === "dnd" ? "Não perturbe" : "Invisível"}</button>)}</div><div className="rounded-xl border border-white/10 p-3"><p className="mb-3 text-xs font-medium text-slate-300">Preferências</p><div className="flex gap-2"><Button type="button" variant="outline" className="border-white/10 bg-white/5 text-xs text-slate-200 hover:bg-white/10" onClick={() => updateSettings.mutate({ privacy: { allowFriendRequests: !(profile.data?.settings?.privacy as Record<string, boolean>)?.allowFriendRequests } })}>Alternar solicitações de amizade</Button><Button type="button" variant="outline" className="border-white/10 bg-white/5 text-xs text-slate-200 hover:bg-white/10" onClick={() => updateSettings.mutate({ notifications: { messages: !(profile.data?.settings?.notifications as Record<string, boolean>)?.messages } })}>Alternar notificações</Button></div></div><DialogFooter><Button type="button" variant="outline" className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10" onClick={() => logout()}>Sair</Button><Button type="submit" disabled={updateProfile.isPending} className="bg-[#cbb38a] text-[#141820] hover:bg-[#dfca9c]">Salvar perfil</Button></DialogFooter></form></DialogContent></Dialog>
    {pendingChatMessages.some(message => message.channelId === channelId) && <div className="fixed bottom-5 right-5 z-40 rounded-xl border border-[#5865f2]/40 bg-[#202a5f]/95 px-3 py-2 text-xs font-medium text-[#e8ebff] shadow-xl" role="status">Enviando mensagem…</div>}
    {call && <Suspense fallback={<div className="call-overlay"><div className="call-loading-overlay">Preparando a chamada…</div></div>}><CallOverlay call={call} onLeave={closeCall} isMinimized={callMinimized} onMinimize={() => setCallMinimized(true)} onRestore={() => setCallMinimized(false)} voiceVideoSettings={profile.data?.settings?.voiceVideo as Record<string, string | boolean> | undefined} onVoiceVideoSettingsChange={settings => updateSettings.mutateAsync({ voiceVideo: settings })} microphoneToggleSignal={microphoneToggleSignal} onMicrophoneStateChange={setCallMicrophoneEnabled} /></Suspense>}
  </main>;
}
