
// @/components/views/MessagesView.tsx

import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../hooks/useAppStore';
import { UserCircleIcon, PaperAirplaneIcon, PaperClipIcon } from '../shared/Icons';
import { Loader } from '../shared/Loader';

export const MessagesView: React.FC = () => {
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
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim() || attachment) {
            sendMessage(newMessage, attachment || undefined);
            setNewMessage('');
            setAttachment(null);
            setPreview(null);
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

    return (
        <div className="max-w-7xl mx-auto h-[calc(100vh-120px)] flex bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden">
            {/* Left Panel: Conversations List */}
            <div className="w-1/3 border-r border-gray-800 flex flex-col">
                <header className="p-4 border-b border-gray-800">
                    <h2 className="text-xl font-bold text-white">Conversations</h2>
                </header>
                <div className="overflow-y-auto flex-grow">
                    {conversations.map(convo => (
                        <button
                            key={convo.id}
                            onClick={() => selectConversation(convo.id)}
                            className={`w-full text-left p-4 flex items-center space-x-3 transition-colors ${activeConversationId === convo.id ? 'bg-brand-secondary/20' : 'hover:bg-gray-800/50'}`}
                        >
                            <UserCircleIcon className="w-10 h-10 text-brand-gray flex-shrink-0" />
                            <div>
                                <p className="font-semibold text-white">{convo.otherUser.name}</p>
                                <p className="text-sm text-brand-gray truncate">
                                    Click to view conversation
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Right Panel: Active Conversation */}
            <div className="w-2/3 flex flex-col">
                {isLoading && !activeConversationId && (
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
                             <UserCircleIcon className="w-8 h-8 text-brand-gray" />
                             <h3 className="font-bold text-lg text-white">{activeConversation.otherUser.name}</h3>
                        </header>
                        <div className="flex-grow p-4 overflow-y-auto space-y-4">
                            {messages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-md p-3 rounded-2xl ${msg.senderId === user.id ? 'bg-brand-primary text-white rounded-br-none' : 'bg-gray-700 text-brand-light rounded-bl-none'}`}>
                                        {msg.attachmentUrl &&