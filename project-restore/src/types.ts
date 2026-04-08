export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  condition: string;
  cardType?: string;
  imageUrl: string;
  imageUrls?: string[];
  sellerName: string;
  sellerPhoto?: string;
  sellerRating?: number;
  englishName?: string;
  status?: string;
  createdAt?: any;
}

export interface WantListing {
  id: string;
  title: string;
  targetPrice: number;
  condition?: string;
  cardType?: string;
  imageUrl?: string;
  userName: string;
  userPhoto?: string;
  createdAt?: any;
  englishName?: string;
}

export interface PortfolioItem {}
