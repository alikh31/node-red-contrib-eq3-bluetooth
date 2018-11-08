'use strict'

const status = {
  manual: 1,
  holiday: 2,
  boost: 4,
  dst: 8,
  openWindow: 16,
  unknown: 32,
  unknown2: 64,
  lowBattery: 128,
}

module.exports = {
  writeCharacteristic: '3fa4585ace4a3baddb4bb8df8179ea09',
  notificationCharacteristic: 'd0e8434dcd290996af416c90f4e0eb2a',
  serviceUuid: '3e135142654f9090134aa6ff5bb77046',
  payload: {
    getSysInfo: () => new Buffer('00', 'hex'),
    activateBoostmode: () => new Buffer('4501', 'hex'),
    deactivateBoostmode: () => new Buffer('4500', 'hex'),
    setAutomaticMode: () => new Buffer('4000', 'hex'),
    setManualMode: () => new Buffer('4040', 'hex'),
    lockThermostat: () => new Buffer('8001', 'hex'),
    unlockThermostat: () => new Buffer('8000', 'hex'),
    setTemperature: temperature => new Buffer(`41${temperature <= 7.5 ? '0' : ''}${(2 * temperature).toString(16)}`, 'hex'),
    setTemperatureOffset: offset => new Buffer(`13${((2 * offset) + 7).toString(16)}`, 'hex'),
    setDay: () => new Buffer('43', 'hex'),
    setNight: () => new Buffer('44', 'hex'),
    setEcoMode: (temp, date) => {
      var tempstr = '00';
      if (!temp){
          tempstr = 'FF'; // 'vacation mode'
      } else {
          tempstr = ('0'+(0x80 | ((temp*2)>>0)).toString(16)).slice(-2);
      }
          
      const prefix = '40';
      var out = undefined;
      if (date){
          const year = ('0'+((date.getFullYear() - 2000)).toString(16)).slice(-2);
          const month = ('0'+(date.getMonth() + 1).toString(16)).slice(-2);
          const day = ('0'+date.getDate().toString(16)).slice(-2);
          var hour = date.getHours();
          const minute = date.getMinutes();
          hour *=2;
          if (minute >= 30){
            hour++;
          }
          hour = ('0'+hour.toString(16)).slice(-2);
          out = new Buffer(prefix+ tempstr + day+year + hour + month, 'hex');
      } else {
          out = new Buffer(prefix+ tempstr, 'hex');
      }
  
      return out;
      },
    setComfortTemperatureForNightAndDay: (night, day) => {
      const tempNight = ('0'+(2 * night).toString(16)).slice(-2);
      const tempDay = ('0'+(2 * day).toString(16)).slice(-2);
      return new Buffer(`11${tempDay}${tempNight}`, 'hex')
    },
    setWindowOpen: (temperature, minDuration) => {
      const temp = ('0'+(2 * temperature).toString(16)).slice(-2);
      const dur = ('0'+(minDuration / 5).toString(16)).slice(-2);
      return new Buffer(`14${temp}${dur}`, 'hex')
    },
    setDatetime: (date) => {
      var out = new Buffer(7);
      out[0] = 3;
      out[1] = date.getFullYear() - 2000;
      out[2] = (date.getMonth() + 1);
      out[3] = date.getDate();
      out[4] = date.getHours();
      out[5] = date.getMinutes();
      out[6] = date.getSeconds();
      return out;
    },

    getDay: (day) => {
      return new Buffer('200'+day, 'hex');
    },

    // set schedule for a day
    // day is { day: <daynum, 0=sat>, segments:[7 x {temp:<temp>, endtime:{ hour:<hour>, min:<min>}}, ...]}
    setDay: (day) => {
      var out = new Buffer(16);
      out[0] = 0x10;
      out[1] = day.day;
  
      // zero all first
      for (var i = 0; i < 7; i++){
        out[(i*2)+2] = 0;
        out[(i*2)+3] = 0;
      }
      
      for (var i = 0; i < 7; i++){
        out[(i*2)+2] = 0;
        out[(i*2)+3] = 0;
        
        if (day.segments[i].temp && 
            day.segments[i].endtime && 
            (day.segments[i].endtime.hour !== undefined) && 
            (day.segments[i].endtime.min !== undefined) ){
            out[(i*2)+2] = (day.segments[i].temp * 2)>>0;
            out[(i*2)+3] = (((day.segments[i].endtime.hour * 60) + day.segments[i].endtime.min)/10)>>0;
        } else {
            break; // stop at first non-temp
        }
      }
      return out;
    }

  },

  // read any return, and convert to a javascript structure
  parseInfo: function(info) {
    try{
      switch(info[0]){
          case 0: // ??
              return { 
                  unknown:true,
                  raw: info,
              };
              break;

          case 1: // sysinfo
              return {
                  sysinfo:{
                      ver: info[1],
                      type: info[2],
                  },
                  raw: info,
              };
              break;

          case 2:
              switch(info[1] & 0xf){
                  case 1: // normal info
                      const statusMask = info[2];
                      const valvePosition = info[3];
                      const targetTemperature = info[5] / 2;
                      
                      var ecoendtime = undefined;            
                      if (((statusMask & status.holiday) === status.holiday) && (info.length >= 10)) {
                          // parse extra bytes
                          var ecotime = {
                              day:info[6],
                              year: info[7]+2000,
                              hour: (info[8]/2)>>0,
                              min: (info[8] & 1)? 30:0,
                              month: info[9],
                          };
                          ecoendtime = new Date(ecotime.year, ecotime.month-1, ecotime.day, ecotime.hour, ecotime.min, 0, 0);
                      }
                      
                      return {
                          raw:info,
                          status: {
                              manual: (statusMask & status.manual) === status.manual,
                              holiday: (statusMask & status.holiday) === status.holiday,
                              boost: (statusMask & status.boost) === status.boost,
                              lock: (statusMask & status.lock) === status.lock,
                              dst: (statusMask & status.dst) === status.dst,
                              openWindow: (statusMask & status.openWindow) === status.openWindow,
                              lowBattery: (statusMask & status.lowBattery) === status.lowBattery,
                              valvePosition,
                              targetTemperature,
                              ecoendtime: ecoendtime,
                          },
                          valvePosition,
                          targetTemperature,
                      };
                      break;
                      
                  case 2: // schedule set response, returns day set
                      var res = {
                          raw:info,
                          dayresponse:{
                              day: info[2]
                          } 
                      }
                      return res;
                      break;
                      
                  case 0x80: // return from setTempOffset 
                      var res = {
                          raw:info,
                      }
                      return res;
                      break;
              }
              break;

          case 4: // time request?
              return {
                  timerequest:true,
                  raw:info,
              };
              break;

          case 0x21:
              var day = {
                  day: info[1],
                  segments: [],
              };
              for (var i = 2; i < info.length; i += 2){
                  var segment = {
                      temp: info[i]/2,
                      endtime:{
                          hour: ((info[i+1]*10)/60)>>0,
                          min: ((info[i+1]*10)%60)>>0,
                      }
                  };
                  day.segments.push(segment);
              }
              return {
                  raw:info,
                  dayschedule: day
              }
              break;
              
          case 0xa0:
              // start firmware update
              return {
                firwareupdate:true,
                raw:info,
              };
              break;
              
          case 0xa1:
              switch(info[1]){
                  default:
                      break;
                  case 0x11: // start next firmware package
                      break;
                  case 0x22: // send next frame
                      break
                  case 0x33: // restart frame transmission
                      break;
                  case 0x44: // update finished
                      break;
              }
              return {
                firwareupdate:true,
                raw:info,
              };
              break;
          default:
              return {
                  unknown:true,
                  raw:info,
              };
              break;
      }
      
    } catch(e){
        return{ 
            error: e.toString(),
            raw:info 
        };
    }
  } // end parseInfo


}
