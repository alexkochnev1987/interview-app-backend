import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class BulkDeleteQuestionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  ids: string[];
}
