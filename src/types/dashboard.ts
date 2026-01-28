export type AnonymizedCandidateProfile = {
    current_role?: string;
    years_experience?: string;
    skills?: string[];
    preferred_roles?: string[];
    salary_expectation?: string;
    availability?: string;
    language?: string;
  };
  
  export type ShortlistItem = {
    score: number;
    summary: string;
    breakdown: {
      skills: number;
      experience: number;
      role_alignment: number;
      industry: number;
      salary: number;
      language: number;
      availability: number;
    };
    profile: AnonymizedCandidateProfile;
    locked: boolean;
  };
  