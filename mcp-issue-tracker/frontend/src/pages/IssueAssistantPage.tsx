import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading";
import { assistantApi } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import type {
  AssistantChatResponse,
  AssistantMessagePayload,
  ChatRole,
  Issue,
} from "@/types";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  createdIssue?: Issue;
  missingTags?: string[];
  validationErrors?: string[];
}

function createMessageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const initialAssistantMessage: ChatMessage = {
  id: createMessageId(),
  role: "assistant",
  content:
    "Hi! I'm your Issue Tracker copilot. Tell me what's happening and I'll gather the details or create an issue for you when we have enough context.",
  createdAt: new Date().toISOString(),
};

export default function IssueAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([initialAssistantMessage]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const toast = useToast();

  useEffect(() => {
    // Auto-focus input on component mount
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    // Refocus input when sending is complete
    if (!isSending && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isSending]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendMessage();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) {
      return;
    }

    const historyPayload: AssistantMessagePayload[] = [
      ...messages.map((message) => ({ role: message.role, content: message.content })),
      { role: "user", content: trimmed },
    ];

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    // Refocus the input after clearing it
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    try {
      const response = await assistantApi.chat(historyPayload);
      if (!response.success || !response.data) {
        throw new Error(response.message || response.error || "Assistant was unable to respond");
      }

      const assistantData: AssistantChatResponse = response.data;
      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: "assistant",
        content: assistantData.reply,
        createdAt: new Date().toISOString(),
        createdIssue: assistantData.createdIssue,
        missingTags: assistantData.missingTags,
        validationErrors: assistantData.validationErrors,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (assistantData.createdIssue) {
        toast.success(`Issue #${assistantData.createdIssue.id} created.`);
      } else if (assistantData.validationErrors?.length) {
        toast.info("I need a bit more detail before I can create that issue.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong while talking to the assistant.";
      toast.error(message);
      // keep the optimistic user message in the timeline
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl py-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] lg:h-[calc(100vh-8rem)]">
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="flex-shrink-0">
            <CardTitle>AI Issue Assistant</CardTitle>
            <CardDescription>
              Chat with the AI-powered assistant to capture issues faster. Provide as much detail as you can and
              let the AI handle the rest.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4 overflow-hidden">
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pr-2">
              {messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-lg border px-4 py-3 text-sm shadow-sm break-words ${
                        isUser
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-inherit overflow-wrap-anywhere">
                        {message.content}
                      </div>
                      {message.createdIssue && (
                        <div className="mt-3 space-y-2 rounded-md bg-background/60 p-3 text-xs text-muted-foreground">
                          <div className="font-medium text-foreground">Issue Created</div>
                          <div className="text-foreground">
                            #{message.createdIssue.id} · {message.createdIssue.title}
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                              Priority: {message.createdIssue.priority}
                            </span>
                            {message.createdIssue.tags?.map((tag) => (
                              <span key={tag.id} className="rounded-full bg-secondary/60 px-2 py-0.5">
                                {tag.name}
                              </span>
                            ))}
                          </div>
                          <Link to={`/issues/${message.createdIssue.id}`} className="inline-flex text-primary underline">
                            View issue detail
                          </Link>
                        </div>
                      )}
                      {message.missingTags?.length ? (
                        <div className="mt-2 text-xs text-yellow-600">
                          Skipped unknown tags: {message.missingTags.join(", ")}
                        </div>
                      ) : null}
                      {message.validationErrors?.length ? (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-destructive">
                          {message.validationErrors.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {isSending && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground">
                    <LoadingSpinner size="sm" />
                    Thinking…
                  </div>
                </div>
              )}
            </div>
            <form onSubmit={handleSubmit} className="flex-shrink-0 space-y-3">
              <textarea
                ref={inputRef}
                className="min-h-[110px] w-full resize-y rounded-lg border border-input bg-background p-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="Describe what happened, any steps to reproduce, expected vs. actual behaviour, and priority."
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSending}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Press Enter to send. Use Shift + Enter for a new line.
                </p>
                <Button type="submit" disabled={isSending || input.trim().length === 0}>
                  {isSending ? "Sending…" : "Send"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Tips for Better Issues</CardTitle>
            <CardDescription>Give the assistant clear signals to create high quality tickets.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Include these details when you want the assistant to open an issue:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Summarise the problem in a short headline.</li>
              <li>Describe the impact, affected area, and any error messages.</li>
              <li>Mention the desired priority such as low, medium, high, or urgent.</li>
              <li>Call out relevant tags (e.g. frontend, api, accessibility).</li>
            </ul>
            <p>
              Prefer natural language conversation. The assistant will ask follow-up questions if it needs more
              detail before creating an issue.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
