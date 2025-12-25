export type Director = {
  id: string;
  name: string;
  role?: string;
  imageUrl: string;
};

// TODO: Replace placeholders with real data from https://www.taxtower.in/about
// You can paste full image URLs from the site or your CDN.
export const DIRECTORS: Director[] = [
  // Example entries (replace):
  // { id: '1', name: 'John Doe', role: 'Managing Director', imageUrl: 'https://example.com/john.jpg' },
  // { id: '2', name: 'Jane Smith', role: 'Director', imageUrl: 'https://example.com/jane.jpg' },
];
