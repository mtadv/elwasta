export type CandidateProfile = {
    name?: string;
    email?: string;
    mobile_number?: string;
    current_role?: string;
    years_experience?: string;
    skills?: string[];
    preferred_roles?: string[];
    salary_expectation?: string;
    availability?: string;
    language?: string;
  };
  
  export type JobBrief = {
    company_type?: string;
    industry?: string;
    role_title?: string;
    seniority?: string;
    responsibilities?: string[];
    must_have_skills?: string[];
    nice_to_have_skills?: string[];
    tools?: string[];
    salary_range?: string;
    work_model?: string;
    urgency?: string;
    success_criteria?: string;
    red_flags?: string;
    language?: string;
  };
  
  export type MatchResult = {
    overall_score: number;
    breakdown: {
      skills: number;
      experience: number;
      role_alignment: number;
      industry: number;
      salary: number;
      language: number;
      availability: number;
    };
    summary: string;
  };
  