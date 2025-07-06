export interface County {
  name: string;
  country: string;
  state: string;
}
export type InterConnectionLevelT = "transmission" | "distribution";
export type PoiDataSource = "heatmap" | "constraint";

export interface PoiStatus {
  type: PoiDataSource;
  available_capacity: number;
  no_of_constraints: number;
}

interface Queue {
  queue: number;
  no_of_projects: number;
}

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

interface PolicyPortfolio {
  policy_portfolio: number;
  year: number;
}

export type MarketType = "DAM" | "RTM_5min";

export interface LMPData {
  substation: {
    id: string;
    name: string;
  };
  energy: number;
  congestion: number;
  loss: number;
  lmp: number;
  time: string;
  market: MarketType;
}

export interface Poi {
  id: string;
  name: string;
  type: InterConnectionLevelT;
  geo_coordinates: GeoCoordinates | null;
  county: County | null;
  voltage: number;
  status: PoiStatus[];
  queue: Queue[];
  policy_portfolio: PolicyPortfolio[];
  study_region: string;
  utility_area: string;
  interconnecting_entity: string;
  has_lmp_data: boolean;
}

export type Gender = {
  [key: string]: "Male" | "Female" | "Unknown";
};

export type Country = {
  [key: string]: string; // Codes for each country, mapping to their names
};

export type SiteTheme = {
  [key: string]: "Light" | "Dark" | "System";
};

export type State = {
  [key: string]: string;
};

export type Region = {
  [key: string]: string;
};

export interface Mappings {
  gender: Gender;
  country: Country;
  site_theme: SiteTheme;
  state: State;
  region: Region;
}

export interface Option {
  key: string;
  label: string;
}

export interface TransmissionLine {
  name: string;
  type: string;
  utility_area: string;
  voltage: number;
  geo_coordinates: [number, number][];
}

export type AverageLMPType = "actual" | "forecast";

export type PoiOrTransmissionLine =
  | {
      item: Poi;
      type: "poi";
    }
  | {
      item: TransmissionLine;
      type: "transmissionLine";
    };

export interface LMPResponse {
  columns: string[];
  rows: string[][];
}

export interface StreamingResponse {
  columns: string[];
  rows: any[][];
}

export type Entity =
  | "user"
  | "circle"
  | "organization"
  | "institution"
  | "resource"
  | "event"
  | "job";

export interface RecommendedEntity {
  id: number;
  name: string;
  title?: string;
  type: Entity;
  image_path?: string | null;
  slug: string;
  sub_type?: "internal" | "external";
  source?: string | null;
}

export interface RecommendationType {
  type: "recommendations";
  value: {
    type:
      | "user"
      | "cirlce"
      | "organization"
      | "internal_resource"
      | "external_resource";
    items: RecommendedEntity[];
  };
}

export interface TextMessage {
  type: "text";
  value: string;
}

export interface RelevantQuestionType {
  type: "relevant_questions";
  value: string[];
}

export type MessageTypes =
  | TextMessage[]
  | RecommendationType[]
  | RelevantQuestionType[];

export interface ChatResponse {
  id: number;
  sender: RecommendedEntity | null;
  recipient: RecommendedEntity | null;
  messages: MessageTypes;
  timestamp: string;
  isError?: boolean;
  isNewMessage?: boolean;
}

export interface ApiResponse<T> {
  data: T;
  success?: boolean;
  message?: string;
  error?: boolean;
}

export interface ApiError {
  message: string;
  status: number;
  [key: string]: unknown;
}

export interface Prompts {
  id: number;
  prompts: string[];
}

export interface AppConfig {
  ama_user_default_prompts: {
    career_stage: Prompts[] | null;
    location: Prompts[] | null;
  } | null;
}

export type SubstationMappingRow = [
  substationType: string,
  interconnectingEntity: string,
  studyRegions: string[],
  utilityAreas: string[]
];

export interface SubstationMappingResponse {
  columns: string[];
  rows: SubstationMappingRow[];
}

export interface FilterState {
  substationType: InterConnectionLevelT;
  interconnectingEntity: string;
  utilityArea: string;
  studyArea: string;
}

export interface FilterOptions {
  substationTypes: { key: string; label: string }[];
  interconnectingEntities: { key: string; label: string }[];
  utilityAreas: { key: string; label: string }[];
  studyAreas: { key: string; label: string }[];
}

export interface UserDetail {
  full_name: string;
  email: string;
}

export type LoginApiResponse = ApiResponse<{
  access: string;
  refresh: string;
  user: UserDetail;
}>;

export interface LoginCred {
  email: string;
  password: string;
}

