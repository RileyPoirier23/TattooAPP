-- Create the profiles table to store user data linked to auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL,
  city TEXT,
  specialty TEXT,
  bio TEXT,
  portfolio JSONB,
  is_verified BOOLEAN DEFAULT false,
  socials JSONB,
  shop_id uuid, -- For shop owners
  hourly_rate NUMERIC -- For artists/dual
);

-- Create the shops table
CREATE TABLE IF NOT EXISTS public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  address TEXT,
  lat NUMERIC,
  lng NUMERIC,
  amenities TEXT[],
  rating NUMERIC, -- Client rating
  average_artist_rating NUMERIC DEFAULT 0,
  image_url TEXT,
  reviews JSONB, -- Artist reviews of the shop
  payment_methods JSONB,
  is_verified BOOLEAN DEFAULT false,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Create the booths table
CREATE TABLE IF NOT EXISTS public.booths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  daily_rate NUMERIC NOT NULL,
  photos TEXT[],
  amenities TEXT[],
  rules TEXT
);

-- Create the bookings table for artists booking booths
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  booth_id uuid REFERENCES public.booths(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  payment_status TEXT DEFAULT 'unpaid',
  total_amount NUMERIC,
  platform_fee NUMERIC,
  payment_intent_id TEXT
);

-- Create the client_booking_requests table
CREATE TABLE IF NOT EXISTS public.client_booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  artist_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date DATE,
  end_date DATE,
  message TEXT,
  status TEXT DEFAULT 'pending',
  tattoo_size TEXT,
  body_placement TEXT,
  estimated_hours INTEGER,
  payment_status TEXT DEFAULT 'unpaid',
  review_rating INTEGER,
  review_text TEXT,
  review_submitted_at TIMESTAMPTZ,
  deposit_amount NUMERIC,
  platform_fee NUMERIC,
  payment_intent_id TEXT
);

-- Create the notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create conversations table to link participants
CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_one_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    participant_two_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(participant_one_id, participant_two_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT,
    attachment_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create artist_availability table
CREATE TABLE IF NOT EXISTS public.artist_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  "date" DATE NOT NULL,
  status TEXT NOT NULL, -- e.g., 'available', 'unavailable'
  UNIQUE(artist_id, "date")
);

-- Create verification_requests table
CREATE TABLE IF NOT EXISTS public.verification_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'artist' or 'shop'
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMPTZ DEFAULT now(),
    CHECK ( (profile_id IS NOT NULL AND shop_id IS NULL AND type = 'artist') OR (profile_id IS NOT NULL AND shop_id IS NOT NULL AND type = 'shop') )
);

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;


-- RLS Policies: Allow public read access for essential data
DROP POLICY IF EXISTS "Public read access for profiles" ON public.profiles;
CREATE POLICY "Public read access for profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for shops" ON public.shops;
CREATE POLICY "Public read access for shops" ON public.shops FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for booths" ON public.booths;
CREATE POLICY "Public read access for booths" ON public.booths FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for bookings" ON public.bookings;
CREATE POLICY "Public read access for bookings" ON public.bookings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for artist_availability" ON public.artist_availability;
CREATE POLICY "Public read access for artist_availability" ON public.artist_availability FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for client booking requests" ON public.client_booking_requests;
CREATE POLICY "Public read access for client booking requests" ON public.client_booking_requests FOR SELECT USING (true);

-- RLS Policies: Allow users to manage their own data
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
CREATE POLICY "Allow users to insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
CREATE POLICY "Allow users to update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Shop owners can create their own shop" ON public.shops;
CREATE POLICY "Shop owners can create their own shop" ON public.shops FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Shop owners can update their own shop" ON public.shops;
CREATE POLICY "Shop owners can update their own shop" ON public.shops FOR UPDATE USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Allow authenticated users to create bookings" ON public.bookings;
CREATE POLICY "Allow authenticated users to create bookings" ON public.bookings FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow artists to view their own bookings" ON public.bookings;
CREATE POLICY "Allow artists to view their own bookings" ON public.bookings FOR SELECT USING (auth.uid() = artist_id);

DROP POLICY IF EXISTS "Allow authenticated users to create client requests" ON public.client_booking_requests;
CREATE POLICY "Allow authenticated users to create client requests" ON public.client_booking_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow users to view their own client requests" ON public.client_booking_requests;
CREATE POLICY "Allow users to view their own client requests" ON public.client_booking_requests FOR SELECT USING (auth.uid() = client_id OR auth.uid() = artist_id);

DROP POLICY IF EXISTS "Allow users to update their own client requests" ON public.client_booking_requests;
CREATE POLICY "Allow users to update their own client requests" ON public.client_booking_requests FOR UPDATE USING (auth.uid() = client_id OR auth.uid() = artist_id);

DROP POLICY IF EXISTS "Allow users to manage their own notifications" ON public.notifications;
CREATE POLICY "Allow users to manage their own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Artists can manage their own availability" ON public.artist_availability;
CREATE POLICY "Artists can manage their own availability" ON public.artist_availability FOR ALL USING (auth.uid() = artist_id);

-- RLS Policies for Messaging
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
CREATE POLICY "Users can view their own conversations" ON public.conversations FOR SELECT USING (auth.uid() = participant_one_id OR auth.uid() = participant_two_id);

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = participant_one_id OR auth.uid() = participant_two_id);

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Users can view messages in their conversations" ON public.messages FOR SELECT USING (
    conversation_id IN (
        SELECT id FROM public.conversations WHERE auth.uid() = participant_one_id OR auth.uid() = participant_two_id
    )
);

DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.messages;
CREATE POLICY "Users can send messages in their conversations" ON public.messages FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    conversation_id IN (
        SELECT id FROM public.conversations WHERE auth.uid() = participant_one_id OR auth.uid() = participant_two_id
    )
);

-- RLS Policies for Verification Requests
DROP POLICY IF EXISTS "Users can create their own verification requests" ON public.verification_requests;
CREATE POLICY "Users can create their own verification requests" ON public.verification_requests FOR INSERT WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Users can see their own verification requests" ON public.verification_requests;
CREATE POLICY "Users can see their own verification requests" ON public.verification_requests FOR SELECT USING (auth.uid() = profile_id);

-- RLS Policies for Admins (Optional, for dev admin user)
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL
USING (((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'));

DROP POLICY IF EXISTS "Admins can manage all shops" ON public.shops;
CREATE POLICY "Admins can manage all shops" ON public.shops FOR ALL
USING (((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'));

DROP POLICY IF EXISTS "Admins can manage verification requests" ON public.verification_requests;
CREATE POLICY "Admins can manage verification requests" ON public.verification_requests FOR ALL
USING (((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'));
