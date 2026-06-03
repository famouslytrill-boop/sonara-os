export type RightsReviewStatus = "pending" | "approved" | "blocked";
export type ReleaseReadinessStatus = "draft" | "review" | "ready" | "blocked";
export interface CreatorAsset {
  organization_id: string;
  creator_id: string;
  project_id: string;
  title: string;
  artist_name?: string;
  album_name?: string;
  bpm?: number;
  musical_key?: string;
  genre_tags: string[];
  mood_tags: string[];
  version_label: string;
  file_record_id: string;
  cover_art_file_id?: string;
  release_status: ReleaseReadinessStatus;
  rights_review_status: RightsReviewStatus;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}
export interface DuplicateAssetWarning {
  duplicate: boolean;
  reason: string;
}
export interface ProductionNotes {
  organization_id: string;
  notes: string;
}
export interface PromptRecord {
  organization_id: string;
  prompt: string;
  safetyReviewed: boolean;
}
export type SongAsset = CreatorAsset;
export interface AlbumProject {
  organization_id: string;
  title: string;
  release_status: ReleaseReadinessStatus;
}
export interface ArtistProfileRef {
  organization_id: string;
  artist_id: string;
}
export interface MetadataSource {
  name: string;
  external: boolean;
}
export interface AudioMetadata {
  bpm?: number;
  musical_key?: string;
  durationSeconds?: number;
}
