'use client';

import { useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@aether/ui/primitives';
import { usePlaygroundChat } from '../hooks/use-playground-chat';
import { usePlaygroundCompare } from '../hooks/use-playground-compare';
import { ModelSidebar } from './model-sidebar';
import { ChatPanel } from './chat-panel';
import { ComparePanel } from './compare-panel';

export function PlaygroundPage() {
  const chat = usePlaygroundChat();
  const compare = usePlaygroundCompare();

  const modelList = chat.models.data ?? [];
  const currentModel = modelList.find((m) => m.id === chat.selectedModel);

  // Auto-select first model
  useEffect(() => {
    if (!chat.selectedModel && modelList.length) {
      chat.setSelectedModel(modelList[0].id);
    }
  }, [modelList, chat.selectedModel]);

  return (
    <div className="relative flex h-full w-full" data-testid="models-playground">
      <Tabs defaultValue="chat" className="flex flex-1 flex-col">
        {/* Tab bar */}
        <div className="absolute right-4 top-3 z-10">
          <TabsList>
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="compare">Compare</TabsTrigger>
          </TabsList>
        </div>

        {/* Chat tab */}
        <TabsContent value="chat" className="flex flex-1 m-0 min-h-0">
          <ModelSidebar
            models={modelList}
            selectedModel={chat.selectedModel}
            onSelect={chat.setSelectedModel}
            isLoading={chat.models.isLoading}
          />
          <ChatPanel
            modelId={chat.selectedModel}
            modelName={currentModel?.display_name ?? ''}
            messages={chat.messages}
            settings={chat.settings}
            isStreaming={chat.isStreaming}
            onSettingsChange={chat.setSettings}
            onSend={chat.sendMessage}
            onStop={chat.stopGeneration}
            onClear={chat.clearChat}
          />
        </TabsContent>

        {/* Compare tab */}
        <TabsContent value="compare" className="flex-1 m-0 min-h-0">
          <ComparePanel
            models={modelList}
            instances={compare.instances}
            input={compare.input}
            anyStreaming={compare.anyStreaming}
            allModelsSelected={compare.allModelsSelected}
            onInputChange={compare.setInput}
            onSetModel={compare.setInstanceModel}
            onSend={compare.sendToAll}
            onStop={compare.stopAll}
            onClear={compare.clearAll}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
