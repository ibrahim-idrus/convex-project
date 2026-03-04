import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-context'
import { getConversationPeerByMessage, sendMessage, subscribeMessages } from '@/lib/mock-api'
import { useDashboardData } from '@/hooks/use-dashboard-data'

export function ChatPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const dashboard = useDashboardData(user?.userId)
  const messageContainerRef = useRef<HTMLDivElement>(null)

  const [peerUserId, setPeerUserId] = useState<string>('')
  const [message, setMessage] = useState('')
  const notificationMessageId = searchParams.get('messageId') ?? ''

  const users = useMemo(() => {
    if (!dashboard.data || !user) return []
    return dashboard.data.users.filter((entry) => entry._id !== user.userId)
  }, [dashboard.data, user])

  const conversationPeerQuery = useQuery({
    queryKey: ['chat-message-peer', user?.userId, notificationMessageId],
    queryFn: () =>
      getConversationPeerByMessage({
        actorUserId: user?.userId ?? '',
        messageId: notificationMessageId,
      }),
    enabled: !!user && !!notificationMessageId,
    staleTime: 60_000,
  })

  const activePeerUserId = peerUserId || conversationPeerQuery.data?.peerUserId || users[0]?._id || ''

  const messagesQuery = useQuery({
    queryKey: ['messages', user?.userId, activePeerUserId],
    queryFn: () =>
      subscribeMessages({
        actorUserId: user?.userId ?? '',
        peerUserId: activePeerUserId,
      }),
    enabled: !!user && !!activePeerUserId,
    refetchInterval: 800,
  })

  const sendMutation = useMutation({
    mutationFn: (payload: { receiverId: string; message: string }) =>
      sendMessage({
        actorUserId: user?.userId ?? '',
        receiverId: payload.receiverId,
        message: payload.message,
      }),
    onSuccess: async () => {
      setMessage('')
      await queryClient.invalidateQueries({ queryKey: ['messages', user?.userId, activePeerUserId] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard', user?.userId] })
    },
  })

  useEffect(() => {
    const container = messageContainerRef.current
    if (!container) return
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
  }, [messagesQuery.data?.length, activePeerUserId])

  if (!user) return null
  if (dashboard.isLoading) return <p className="text-sm text-[#5f7594]">Loading chat...</p>

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card className="rounded-2xl p-4">
        <h2 className="mb-3 text-lg font-extrabold text-[#102f5f]">Conversations</h2>
        <div className="space-y-1">
          {users.map((entry) => (
            <button
              key={entry._id}
              className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                activePeerUserId === entry._id ? 'bg-[#123a74] text-white' : 'hover:bg-[#eff4fb]'
              }`}
              onClick={() => setPeerUserId(entry._id)}
            >
              <p className="font-semibold">{entry.fullName}</p>
              <p className="text-xs opacity-70">{entry.email}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card className="rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between border-b border-[#e2e9f3] pb-2">
          <h2 className="text-lg font-extrabold text-[#102f5f]">
            {users.find((entry) => entry._id === activePeerUserId)?.fullName ?? 'Select User'}
          </h2>
          <p className="text-xs text-[#6b819f]">Realtime polling demo</p>
        </div>

        <div ref={messageContainerRef} className="h-[420px] space-y-2 overflow-y-auto rounded-xl bg-[#f7faff] p-3">
          {messagesQuery.isLoading && <p className="text-sm text-[#5f7594]">Loading messages...</p>}
          {messagesQuery.data?.map((msg) => {
            const isMine = String(msg.senderId) === String(user.userId)
            return (
              <div key={msg._id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                  <p className="mb-1 px-1 text-[11px] text-[#6b819f]">
                    {isMine ? 'You' : users.find((entry) => entry._id === msg.senderId)?.fullName ?? 'User'}
                  </p>
                  <div
                    className={`relative rounded-2xl px-3 py-2 text-sm ${
                      isMine
                        ? 'rounded-br-sm bg-[#133a73] text-white'
                        : 'rounded-bl-sm bg-white text-[#16355f] shadow-[0_8px_20px_-18px_rgba(14,36,67,0.9)]'
                    }`}
                  >
                    <p>{msg.message}</p>
                    <p className="mt-1 text-[11px] opacity-75">{new Date(msg.createdAt).toLocaleTimeString()}</p>
                  </div>
                </div>
              </div>
            )
          })}
          {messagesQuery.data?.length === 0 && (
            <p className="text-sm text-[#6f849f]">No messages yet. Start conversation.</p>
          )}
        </div>

        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (!activePeerUserId || !message.trim()) return
            sendMutation.mutate({ receiverId: activePeerUserId, message: message.trim() })
          }}
        >
          <Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Type message" />
          <Button disabled={sendMutation.isPending || !activePeerUserId}>Send</Button>
        </form>
      </Card>
    </div>
  )
}
