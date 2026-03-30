import { Controller, Get, Query } from "@nestjs/common";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getStatus() {
    return this.appService.getStatus();
  }

  @Get("slow")
  async slow(@Query("duration") duration?: string) {
    return this.appService.slowProcess(parseInt(duration ?? "15", 10));
  }
}
