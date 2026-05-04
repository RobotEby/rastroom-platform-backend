import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "admin@rastroom.local" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Rastroom@123" })
  @IsString()
  @MinLength(6)
  password!: string;
}
