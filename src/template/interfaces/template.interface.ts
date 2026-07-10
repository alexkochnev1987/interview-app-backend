export interface Template {
  id: string;
  name: string;
  description?: string;
  position?: string;
  /** Ordered live references to questions; resolved to current rows on read. */
  questionIds: string[];
  createdById?: string;
  demo: boolean;
  /** Times an interview has been created from this template (popularity). */
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}
