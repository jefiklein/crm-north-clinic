// (O código é o mesmo que antes, só alterando a parte do JSX da lista de conversas)

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, TriangleAlert, Loader2 } from 'lucide-react';
import { useQuery } from "@tanstack/react-query";
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

// (Interfaces e funções auxiliares permanecem iguais, omitidas aqui para foco)

// ConversasPage componente
const ConversasPage: React.FC<ConversasPageProps> = ({ clinicData }) => {
  // ... estados, hooks, queries, etc. permanecem iguais

  // JSX render
  return (
    <div className="conversations-container flex flex-grow h-full overflow-hidden bg-white rounded-lg shadow-md border border-gray-200">
      {/* Conversations List Panel */}
      <div className="conversations-list-panel w-[350px] border-r border-gray-200 flex flex-col flex-shrink-0 overflow-hidden">
        <div className="list-header p-4 border-b border-gray-200 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              type="text"
              placeholder="Buscar conversas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-full"
            />
          </div>
        </div>
        <ScrollArea className="conversations-list flex-grow">
          {isLoadingSummaries ? (
            <div className="status-message loading-message flex flex-col items-center justify-center p-8 text-primary">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <span>Carregando conversas...</span>
            </div>
          ) : summariesError ? (
            <div className="status-message error-message flex flex-col items-center justify-center p-4 text-red-600 bg-red-50 rounded-md m-4">
              <TriangleAlert className="h-8 w-8 mb-4" />
              <span>Erro ao carregar conversas: {summariesError.message}</span>
            </div>
          ) : filteredAndSortedSummaries.length === 0 ? (
            <div className="status-message text-gray-700 p-8 text-center">
              {searchTerm ? 'Nenhuma conversa encontrada com este filtro.' : 'Nenhuma conversa encontrada.'}
            </div>
          ) : (
            filteredAndSortedSummaries.map(conv => {
              const conversationId = conv.remoteJid;
              const contactName = conv.nome || ''; // Show nome_lead or empty string
              const lastMessageTimestamp = formatTimestampSimple(conv.lastTimestamp);
              const totalMessages = messageCountsData?.[conversationId] ?? 0;

              let lastMessagePreview = '';
              if (conv.lastMessage && typeof conv.lastMessage === 'string' && conv.lastMessage.trim()) {
                lastMessagePreview = conv.lastMessage.trim().substring(0, 50) + (conv.lastMessage.trim().length > 50 ? '...' : '');
              } else {
                lastMessagePreview = '...';
              }

              return (
                <div
                  key={conversationId}
                  className={cn(
                    "conversation-list-item flex flex-col p-3 border-b border-gray-100 cursor-pointer transition-colors",
                    selectedConversationId === conversationId ? 'bg-gray-100' : 'hover:bg-gray-50'
                  )}
                  onClick={() => setSelectedConversationId(conversationId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarFallback className="bg-gray-300 text-gray-800 text-sm font-semibold">{getInitials(contactName)}</AvatarFallback>
                      </Avatar>
                      <span className="contact-name font-semibold text-sm whitespace-nowrap overflow-hidden text-ellipsis">{contactName}</span>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0 ml-2" style={{ minWidth: '110px' }}>
                      <span
                        className="text-xs text-gray-500"
                        title={lastMessageTimestamp || 'Sem data'}
                      >
                        {lastMessageTimestamp || 'Sem data'}
                      </span>
                      <span
                        className="text-xs text-gray-400"
                        title={`Total de mensagens: ${totalMessages}`}
                      >
                        Total: {formatTotalMessages(totalMessages)}
                      </span>
                    </div>
                  </div>
                  <div className="last-message-preview text-xs text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis mt-1">{lastMessagePreview}</div>
                </div>
              );
            })
          )}
        </ScrollArea>
      </div>

      {/* Conversation Detail Panel */}
      <div className="conversation-detail-panel flex-grow flex flex-col overflow-hidden bg-gray-50">
        <div className="detail-header p-4 border-b border-gray-200 font-semibold flex-shrink-0 min-h-[60px] flex items-center bg-gray-100">
          <span id="conversationContactName" className="text-primary">
            {selectedConversationSummary ? (
              selectedConversationSummary.nome || ''
            ) : (
              'Selecione uma conversa'
            )}
          </span>
          {selectedConversationSummary && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto text-xs h-auto py-1 px-2"
              onClick={() => {
                const phone = selectedConversationSummary.remoteJid;
                if (!phone) return;
                const clean = String(phone).replace(/\D/g, '');
                if (clean) {
                  window.open(`https://n8n-n8n.sbw0pc.easypanel.host/webhook/9c8216dd-f489-464e-8ce4-45c226489f4a?phone=${clean}`, '_blank');
                }
              }}
            >
              Ver Detalhes do Lead
            </Button>
          )}
        </div>
        <ScrollArea id="messagesArea" className="messages-area flex-grow p-4 flex flex-col">
          {(!selectedConversationId) ? (
            <div className="status-message text-gray-700 text-center">Selecione uma conversa na lista à esquerda.</div>
          ) : isLoadingMessages ? (
            <div className="status-message loading-message flex flex-col items-center justify-center p-8 text-primary">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <span>Carregando mensagens...</span>
            </div>
          ) : messagesError ? (
            <div className="status-message error-message flex flex-col items-center justify-center p-4 text-red-600 bg-red-100 rounded-md">
              <TriangleAlert className="h-8 w-8 mb-4" />
              <span>Erro ao carregar mensagens: {messagesError.message}</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="status-message text-gray-700 text-center">Nenhuma mensagem nesta conversa.</div>
          ) : (
            <>
              {messages.map(msg => (
                <div key={msg.id} className={cn(
                  "message-bubble max-w-[75%] p-3 rounded-xl mb-2 text-sm leading-tight break-words relative",
                  msg.from_me ? 'bg-green-200 ml-auto rounded-br-md' : 'bg-white mr-auto rounded-bl-md border border-gray-200'
                )}>
                  <div dangerouslySetInnerHTML={{ __html: (msg.mensagem || '').replace(/\*(.*?)\*/g, '<strong>$1</strong>').replace(/_(.*?)_/g, '<em>$1</em>').replace(/\\n|\n/g, '<br>') }}></div>
                  <span className="message-timestamp text-xs text-gray-500 mt-1 block text-right">{formatTimestampSimple(msg.message_timestamp)}</span>
                </div>
              ))}
              <div ref={scrollSentinelRef} />
            </>
          )}
        </ScrollArea>
        <div className="message-input-area p-4 border-t border-gray-200 flex-shrink-0 bg-gray-100">
          <Input type="text" placeholder="Digite sua mensagem aqui..." disabled={!selectedConversationId} />
        </div>
      </div>
    </div>
  );
};

export default ConversasPage;