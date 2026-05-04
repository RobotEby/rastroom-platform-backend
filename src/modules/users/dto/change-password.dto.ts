import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  current_password!: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  new_password!: string;
}
