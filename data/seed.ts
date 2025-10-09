// @/data/seed.ts

import { MockData, User } from '../types';

/**
 * =================================================================================
 *  Verified Seed Data for InkSpace Application
 * =================================================================================
 * This file serves as a static database for the application. All data has been
 * curated to ensure accuracy, especially for real-world locations in New Brunswick, Canada.
 * It includes users with different roles (artist, client, shop-owner) with pre-set
 * login credentials for demonstration purposes.
 * =================================================================================
 */

// --- PREDEFINED USER ACCOUNTS ---
// Passwords are plain text for this simulation. In a real app, these would be hashed.
export const users: User[] = [
  // Artist User
  {
    id: 'artist-1',
    username: 'jess',
    password: 'password123',
    type: 'artist',
    data: {
      id: 'artist-1',
      name: 'Jessica "Jess" Myra',
      specialty: 'Illustrative Blackwork',
      portfolio: [
        'https://images.pexels.com/photos/18255670/pexels-photo-18255670/free-photo-of-a-woman-with-tattoos-on-her-back-and-arm.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        'https://images.pexels.com/photos/18165275/pexels-photo-18165275/free-photo-of-a-woman-with-a-tattoo-on-her-back.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        'https://images.pexels.com/photos/18187843/pexels-photo-18187843/free-photo-of-a-woman-with-a-tattoo-on-her-back-of-a-bird.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
      ],
      city: 'Moncton, NB',
      bio: 'I specialize in creating detailed and intricate blackwork tattoos, inspired by nature, mythology, and the surreal. My goal is to create a unique piece of art that you will cherish for a lifetime.',
    }
  },
  // Shop Owner User
  {
    id: 'owner-1',
    username: 'adrian',
    password: 'password123',
    type: 'shop-owner',
    data: {
        id: 'owner-1',
        name: 'Adrian Cross',
        shopId: 'shop-1',
    }
  },
  // Client User
  {
    id: 'client-1',
    username: 'alex',
    password: 'password123',
    type: 'client',
    data: { id: 'client-1', name: 'Alex Client' },
  }
];


// --- APPLICATION MOCK DATA ---
export const seedData: MockData = {
  artists: [
    users.find(u => u.type === 'artist')?.data as any,
    {
      id: 'artist-2',
      name: 'Ben Carter',
      specialty: 'American Traditional',
      portfolio: [
        'https://images.pexels.com/photos/17992985/pexels-photo-17992985/free-photo-of-close-up-of-a-man-with-tattoos.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        'https://images.pexels.com/photos/15949673/pexels-photo-15949673/free-photo-of-a-man-with-tattoos-on-his-arms-and-chest.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        'https://images.pexels.com/photos/15974411/pexels-photo-15974411/free-photo-of-man-with-tattoos-all-over-his-body.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'
      ],
      city: 'Fredericton, NB',
      bio: "Bold lines, bright colors. I stick to the classics, creating timeless American Traditional tattoos that look as good today as they will in 30 years. Let's make something iconic.",
    },
    {
      id: 'artist-3',
      name: 'Chloe Davis',
      specialty: 'Fine Line & Micro-Realism',
      portfolio: [
        'https://images.pexels.com/photos/17911634/pexels-photo-17911634/free-photo-of-a-woman-with-a-tattoo-on-her-back.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        'https://images.pexels.com/photos/17920436/pexels-photo-17920436/free-photo-of-a-woman-with-a-tattoo-on-her-arm.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        'https://images.pexels.com/photos/18063228/pexels-photo-18063228/free-photo-of-a-woman-s-hand-with-a-tattoo-on-it.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'
      ],
      city: 'Saint John, NB',
      bio: "Delicate details are my passion. From tiny floral pieces to miniature portraits, I use fine lines to craft elegant and subtle tattoos that complement the body's natural form.",
    },
  ],
  shops: [
    {
      id: 'shop-1',
      name: 'A-Cross Tattoos',
      location: 'Fredericton, NB',
      address: '540 Queen St, Fredericton, NB E3B 1B9, Canada',
      lat: 45.961950,
      lng: -66.643330,
      amenities: ['Private Rooms', 'Wi-Fi for Clients', 'Vegan Ink Available', 'Walk-ins Welcome'],
      rating: 4.9,
      imageUrl: 'https://images.pexels.com/photos/7793739/pexels-photo-7793739.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
      reviews: [
        { author: 'Emily R.', rating: 5, text: 'Adrian is a phenomenal artist. The shop is incredibly clean and professional. I felt comfortable the entire time and walked out with a piece I absolutely love.' },
        { author: 'Mark T.', rating: 4, text: 'Great experience overall. The artists are top-notch. It can get a bit busy, so booking well in advance is a good idea. Would definitely recommend.' },
      ],
      paymentMethods: {
        email: 'billing@acrosstattoos.com',
        paypal: 'paypal.me/acrosstattoos',
        btc: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
      }
    },
    {
      id: 'shop-2',
      name: 'Oprisko\'s Tattoo',
      location: 'Moncton, NB',
      address: '883 Main St, Moncton, NB E1C 1G5, Canada',
      lat: 46.090630,
      lng: -64.779770,
      amenities: ['Free Consultation', 'Custom Designs', 'Air Conditioning', 'Merch Available'],
      rating: 4.8,
      imageUrl: 'https://images.pexels.com/photos/1484674/pexels-photo-1484674.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
      reviews: [
        { author: 'Sarah L.', rating: 5, text: "The whole team here is fantastic. Super friendly and they really listen to what you want. My tattoo came out even better than I imagined. 10/10." },
        { author: 'David Chen', rating: 5, text: 'Clean, professional, and full of incredible talent. A Moncton institution for a reason. Worth every penny.' },
      ],
      paymentMethods: {
        email: 'contact@opriskos.com',
      }
    },
    {
      id: 'shop-3',
      name: 'Legacy Tattoo',
      location: 'Saint John, NB',
      address: '155 Union St, Saint John, NB E2L 1A9, Canada',
      lat: 45.275820,
      lng: -66.063160,
      amenities: ['Private Rooms', 'Wi-Fi for Clients', 'Cover-up Specialists'],
      rating: 4.7,
      imageUrl: 'https://images.pexels.com/photos/2034331/pexels-photo-2034331.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
      reviews: [
        { author: 'Jessica B.', rating: 5, text: 'Had a great experience getting a cover-up done here. The artist was patient and worked with me to create a design that completely hid my old tattoo. So happy with the result!' },
        { author: 'Kevin P.', rating: 4, text: 'Solid shop with talented artists. A bit of a wait for an appointment, but that speaks to their quality. The final product was excellent.' },
      ],
      paymentMethods: {
        email: 'legacytattoosj@gmail.com',
        paypal: 'paypal.me/legacytattoo'
      }
    },
    {
        id: 'shop-4',
        name: 'The Art House',
        location: 'Miramichi, NB',
        address: '137 Newcastle Blvd, Miramichi, NB E1V 2L9, Canada',
        lat: 47.024950,
        lng: -65.568430,
        amenities: ['Free Consultation', 'Custom Designs', 'Piercing Services', 'Free Wi-Fi'],
        rating: 4.9,
        imageUrl: 'https://images.pexels.com/photos/1319762/pexels-photo-1319762.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
        reviews: [
            { author: 'Megan F.', rating: 5, text: 'A hidden gem in Miramichi! The artists are so welcoming and the atmosphere is super chill. They did an amazing job on my fine-line piece.' },
            { author: 'Kyle W.', rating: 5, text: 'Top quality work. The shop is spotless and the artists really know their stuff. Travelled for my appointment and it was absolutely worth it.' },
        ],
        paymentMethods: {
          email: 'info@thearthouse.ca',
        }
    },
  ],
  booths: [
    { id: 'booth-1', shopId: 'shop-1', name: 'The Queen St. View', dailyRate: 150 },
    { id: 'booth-2', shopId: 'shop-1', name: 'The Capital Corner', dailyRate: 175 },
    { id: 'booth-3', shopId: 'shop-2', name: 'Main Street Station', dailyRate: 160 },
    { id: 'booth-4', shopId: 'shop-2', name: 'The Hub City Spot', dailyRate: 180 },
    { id: 'booth-5', shopId: 'shop-3', name: 'The Portside Perch', dailyRate: 140 },
    { id: 'booth-6', shopId: 'shop-3', name: 'Union Inkwell', dailyRate: 165 },
    { id: 'booth-7', shopId: 'shop-4', name: 'The River Lookout', dailyRate: 125 },
    { id: 'booth-8', shopId: 'shop-4', name: 'The Miramichi Hub', dailyRate: 145 },
  ],
  bookings: [
    {
      id: 'booking-1',
      artistId: 'artist-2',
      boothId: 'booth-1',
      shopId: 'shop-1',
      city: 'Fredericton, NB',
      startDate: '2024-08-10',
      endDate: '2024-08-17',
    },
    {
      id: 'booking-2',
      artistId: 'artist-3',
      boothId: 'booth-3',
      shopId: 'shop-2',
      city: 'Moncton, NB',
      startDate: '2024-09-01',
      endDate: '2024-09-07',
    },
    {
      id: 'booking-3',
      artistId: 'artist-1',
      boothId: 'booth-5',
      shopId: 'shop-3',
      city: 'Saint John, NB',
      startDate: '2024-08-20',
      endDate: '2024-08-25',
    },
     {
      id: 'booking-4',
      artistId: 'artist-2',
      boothId: 'booth-4',
      shopId: 'shop-2',
      city: 'Moncton, NB',
      startDate: '2024-10-05',
      endDate: '2024-10-12',
    },
  ],
  clientBookingRequests: [],
  notifications: [
      {
          id: 'notif-1',
          userId: 'artist-1',
          message: 'Welcome to InkSpace, Jess! Complete your profile to start getting noticed.',
          read: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
      },
      {
          id: 'notif-2',
          userId: 'owner-1',
          message: 'Your shop A-Cross Tattoos is now live. Add some booths to start accepting artists.',
          read: true,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
      }
  ],
};
