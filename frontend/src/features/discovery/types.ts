export interface PlaceCategory { id: string; name: string; icon: string }
export interface Place {
  id: string; name: string; city: string; category: PlaceCategory; summary: string; why_visit: string; fact: string
  image_url: string; image_credit: string; visited: boolean; saved: boolean; times_chosen: number
}
