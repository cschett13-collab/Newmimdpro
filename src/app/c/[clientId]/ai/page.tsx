import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients";
import { PageHeader } from "@/components/PageHeader";
import { ChatAssistant } from "@/components/ChatAssistant";
import { isClaudeConfigured } from "@/lib/claude";

export const dynamic = "force-dynamic";

export default function AssistantPage({
  params,
}: {
  params: { clientId: string };
}) {
  const client = getClient(params.clientId);
  if (!client) notFound();
  return (
    <>
      <PageHeader
        title="AI assistant"
        subtitle={`Ask questions about ${client.name}'s live HighLevel data`}
      />
      <div className="p-6 lg:p-8">
        <ChatAssistant
          clientId={client.id}
          clientName={client.name}
          configured={isClaudeConfigured()}
        />
      </div>
    </>
  );
}
