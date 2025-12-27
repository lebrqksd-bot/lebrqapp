export const CONTACT_DETAILS = {
  phone: '+919633181898',
  whatsapp: '+916238191898',
  zumbaWhatsapp: '+919745405059', // Zumba & enquiry specific number
  landlines: ['04994-225-895', '04994-225-896', '04994-225-897', '04994-225-898'],
  email: 'lebrq@gmail.com',
  addressTitle: 'Our Address',
  addressLines: [
    'Third Floor City Complex, Karandakkad',
    'Kasaragod, Kerala - 671121',
  ],
  mapsQuery: 'Third Floor City Complex, Karandakkad, Kasaragod, Kerala 671121',
  mapsUrl:
    'https://www.google.com/maps/dir/10.0040704,76.316672/BRQ+GLOB+TECH+PVT+LTD,+City+Complex,+1ST+FLOOR,+Karandakkad,+Kasaragod,+Kerala+671121/@11.2463361,74.3670047,8z/data=!3m2!4b1!5s0x3ba48267077d609d:0x23d1978f2c41c136!4m9!4m8!1m1!4e1!1m5!1m1!1s0x3ba483b89a1bf4f5:0xa63dbc7dc3b6c2b9!2m2!1d74.9884563!2d12.5074692?entry=ttu&g_ep=EgoyMDI1MTAxNC4wIKXMDSoASAFQAw%3D%3D',
  hours: [
    { day: 'Mon', time: '9:00 AM - 6:00 PM' },
    { day: 'Tue', time: '9:00 AM - 6:00 PM' },
    { day: 'Wed', time: '9:00 AM - 6:00 PM' },
    { day: 'Thu', time: '9:00 AM - 6:00 PM' },
    { day: 'Fri', time: '9:00 AM - 6:00 PM' },
    { day: 'Sat', time: '9:00 AM - 6:00 PM' },
    { day: 'Sun', time: 'Closed' },
  ] as Array<{ day: string; time: string }>,
  social: {
    instagram: '',
    facebook: '',
    youtube: '',
    linkedin: '',
    twitter: '',
  },
} as const;
