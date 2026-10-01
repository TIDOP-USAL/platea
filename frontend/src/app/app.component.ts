import { Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { SplashScreen } from '@capacitor/splash-screen';

import { CapasService } from './services/capas.service';


@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  constructor(private capasService: CapasService) {
  }

  async ngOnInit() {
    await this.capasService.init();
    await SplashScreen.hide({
      fadeOutDuration: 400
    });
  }

}
