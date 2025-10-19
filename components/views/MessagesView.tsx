// @/components/views/MessagesView.tsx

import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { UserCircleIcon, PaperAirplaneIcon, PaperClipIcon, XIcon, ArrowLeftIcon } from '../shared/Icons';
import { Loader } from '../shared/Loader';

interface MessagesViewProps {
    conversationId?: string;
    navigate: (path: string) => void;
}

export const MessagesView: React.FC<MessagesViewProps> = ({ conversationId, navigate }) => {
    const { 
        data: { conversations, messages }, 
        user, 
        isLoading, 
        activeConversationId, 
        selectConversation, 
        sendMessage 
    } = useAppStore();
    
    const [newMessage, setNewMessage] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const activeConversation = conversations.find(c => c.id === activeConversationId);

    useEffect(() => {
        // Sync component state with URL
        if(conversationId !== activeConversationId) {
            selectConversation(conversationId || null);
        }
    }, [conversationId, activeConversationId, selectConversation]);


    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim() || attachment) {
            sendMessage(newMessage, attachment || undefined);
            setNewMessage('');
            setAttachment(null);
            setPreview(null);
            if(fileInputRef.current) fileInputRef.current.value = '';
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAttachment(file);
            const reader = new FileReader();
            reader.onloadend = () => setPreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    if (!user) return null;

    const isChatVisibleMobile = !!activeConversationId;

    return (
        <div className="max-w-7xl mx-auto h-[calc(100vh-120px)] flex bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden">
            {/* Left Panel: Conversations List */}
            <div className={`w-full md:w-1/3 border-r border-gray-800 flex-col ${isChatVisibleMobile ? 'hidden md:flex' : 'flex'}`}>
                <header className="p-4 border-b border-gray-800">
                    <h2 className="text-xl font-bold text-white">Conversations</h2>
                </header>
                <div className="overflow-y-auto flex-grow">
                    {conversations.length > 0 ? conversations.map(convo => (
                        <button
                            key={convo.id}
                            onClick={() => navigate(`/messages/${convo.id}`)}
                            className={`w-full text-left p-4 flex items-center space-x-3 transition-colors ${activeConversationId === convo.id ? 'bg-brand-secondary/20' : 'hover:bg-gray-800/50'}`}
                        >
                            <UserCircleIcon className="w-10 h-10 text-brand-gray flex-shrink-0" />
                            <div>
                                <p className="font-semibold text-white">{convo.otherUser.name}</p>
                            </div>
                        </button>
                    )) : (
                         <div className="p-8 text-center text-brand-gray">
                            <h3 className="font-semibold text-white">No Conversations Yet</h3>
                            <p className="text-sm mt-1">Start a conversation by messaging an artist from their profile.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel: Active Conversation */}
            <div className={`w-full md:w-2/3 flex-col ${isChatVisibleMobile ? 'flex' : 'hidden md:flex'}`}>
                {isLoading && (
                    <div className="flex-grow flex items-center justify-center"><Loader/></div>
                )}
                {!activeConversationId && !isLoading && (
                     <div className="flex-grow flex flex-col items-center justify-center text-center p-4">
                        <PaperAirplaneIcon className="w-16 h-16 text-gray-700 mb-4" />
                        <h3 className="text-xl font-semibold text-white">Select a Conversation</h3>
                        <p className="text-brand-gray">Choose a conversation from the left to start chatting.</p>
                    </div>
                )}
                {activeConversation && (
                    <>
                        <header className="p-4 border-b border-gray-800 flex items-center space-x-3">
                             <button onClick={() => navigate('/messages')} className="md:hidden p-1 text-brand-gray hover:text-white">
                                <ArrowLeftIcon className="w-6 h-6" />
                             </button>
                             <UserCircleIcon className="w-8 h-8 text-brand-gray" />
                             <h3 className="font-bold text-lg text-white">{activeConversation.otherUser.name}</h3>
                        </header>
                        <div className="flex-grow p-4 overflow-y-auto space-y-4">
                            {messages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-md p-3 rounded-2xl ${msg.senderId === user.id ? 'bg-brand-primary text-white rounded-br-none' : 'bg-gray-700 text-brand-light rounded-bl-none'}`}>
                                        {msg.attachmentUrl && (
                                            <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer">
                                                <img src={msg.attachmentUrl} alt="Attachment" className="rounded-lg mb-2 max-w-xs max-h-48" />
                                            </a>
                                        )}
                                        {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                         <footer className="p-4 border-t border-gray-800">
                            {preview && (
                                <div className="relative mb-2 w-24">
                                    <img src={preview} alt="Preview" className="w-24 h-24 object-cover rounded-lg" />
                                    <button 
                                        onClick={() => { setAttachment(null); setPreview(null); if(fileInputRef.current) fileInputRef.current.value = ''; }} 
                                        className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 transition-transform hover:scale-110"
                                    >
                                        <XIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                            <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-brand-gray hover:text-white transition-colors">
                                    <PaperClipIcon className="w-6 h-6" />
                                </button>
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type your message..."
                                    className="flex-grow bg-gray-800 rounded-full py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                />
                                <button type="submit" className="bg-brand-primary text-white rounded-full p-3 hover:bg-opacity-80 transition-transform hover:scale-110">
                                    <PaperAirplaneIcon className="w-5 h-5" />
                                </button>
                            </form>
                        </footer>
                    </>
                )}
            </div>
        </div>
    );
};
