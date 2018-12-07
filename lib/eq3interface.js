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

// convert any number to 2 digits hex.
// ensures integer, and takes last two digits of hex conversion with zero filling to 2 if < 16
var h2 = function(val) {
  return ('0' + (number >> 0).toString(16)).slice(-2);
};

module.exports = {
  writeCharacteristic: '3fa4585ace4a3baddb4bb8df8179ea09',
  notificationCharacteristic: 'd0e8434dcd290996af416c90f4e0eb2a',
  serviceUuid: '3e135142654f9090134aa6ff5bb77046',
  payload: {
    getSysInfo: () => new Buffer('00', 'hex'), // note change from 03 - 03 is set date, and was RESETTING date every call.
    activateBoostmode: () => new Buffer('4501', 'hex'),
    deactivateBoostmode: () => new Buffer('4500', 'hex'),
    setAutomaticMode: () => new Buffer('4000', 'hex'),
    setManualMode: () => new Buffer('4040', 'hex'),
    lockThermostat: () => new Buffer('8001', 'hex'),
    unlockThermostat: () => new Buffer('8000', 'hex'),
    setTemperature: temperature => new Buffer(`41${h2(2 * temperature)}`, 'hex'),
    setTemperatureOffset: offset => new Buffer(`13${h2((2 * offset) + 7)}`, 'hex'),
    setDay: () => new Buffer('43', 'hex'),
    setNight: () => new Buffer('44', 'hex'),
    setEcoMode: (temp, date) => {
      var tempstr = '00';
      if (!temp) {
        tempstr = 'FF'; // 'vacation mode'
      } else {
        tempstr = h2(0x80 | ((temp * 2) >> 0));
      }

      const prefix = '40';
      var out = undefined;
      if (date) {
        const year = h2(date.getFullYear() - 2000);
        const month = h2(date.getMonth() + 1);
        const day = h2(date.getDate());
        var hour = date.getHours();
        const minute = date.getMinutes();
        hour *= 2;
        if (minute >= 30) {
          hour++;
        }
        hour = h2(hour);
        out = new Buffer(prefix + tempstr + day + year + hour + month, 'hex');
      } else {
        out = new Buffer(prefix + tempstr, 'hex');
      }

      return out;
    },
    setComfortTemperatureForNightAndDay: (night, day) => {
      const tempNight = h2(2 * night);
      const tempDay = h2(2 * day);
      return new Buffer(`11${tempDay}${tempNight}`, 'hex')
    },
    setWindowOpen: (temperature, minDuration) => {
      const temp = h2(2 * temperature);
      const dur = h2(minDuration / 5);
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
      return new Buffer('200' + day, 'hex');
    },

    // set schedule for a day
    // day is { day: <daynum, 0=sat>, segments:[7 x {temp:<temp>, endtime:{ hour:<hour>, min:<min>}}, ...]}
    setDay: (day) => {
      var out = new Buffer(16);
      out[0] = 0x10;
      out[1] = day.day;

      // zero all first
      for (var i = 0; i < 7; i++) {
        out[(i * 2) + 2] = 0;
        out[(i * 2) + 3] = 0;
      }

      for (var i = 0; i < 7; i++) {
        out[(i * 2) + 2] = 0;
        out[(i * 2) + 3] = 0;

        if (day.segments[i].temp &&
          day.segments[i].endtime &&
          (day.segments[i].endtime.hour !== undefined) &&
          (day.segments[i].endtime.min !== undefined)) {
          out[(i * 2) + 2] = (day.segments[i].temp * 2) >> 0;
          out[(i * 2) + 3] = (((day.segments[i].endtime.hour * 60) + day.segments[i].endtime.min) / 10) >> 0;
        } else {
          break; // stop at first non-temp
        }
      }
      return out;
    }

  },

  ////////////////////////////////////////////////
  // start of parse functions.
  // these parse the response data - send as notify
  //
  // don't know what info[0] = 0 could mean, or remember if I've ever seen it 
  parseInfo_00: function(info) {
    return {
      unknown: true,
      raw: info,
    };
  },

  // sysinfo
  parseSysInfo: function(info) {
    return {
      sysinfo: {
        ver: info[1],
        type: info[2],
      },
      raw: info,
    };
  },

  // for 02x1 responses
  parseStatus: function(info) {
    const statusMask = info[2];
    const valvePosition = info[3];
    const targetTemperature = info[5] / 2;

    var ecoendtime = undefined;
    if (((statusMask & status.holiday) === status.holiday) && (info.length >= 10)) {
      // parse extra bytes
      var ecotime = {
        day: info[6],
        year: info[7] + 2000,
        hour: (info[8] / 2) >> 0,
        min: (info[8] & 1) ? 30 : 0,
        month: info[9],
      };
      ecoendtime = new Date(ecotime.year, ecotime.month - 1, ecotime.day, ecotime.hour, ecotime.min, 0, 0);
    }

    return {
      raw: info,
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
  },

  // for 02x2 responses
  // schedule set response, returns day set
  parseScheduleSetResp: function(info) {
    var res = {
      raw: info,
      dayresponse: {
        day: info[2]
      }
    }
    return res;
  },

  // for 0280 responses
  parseTempOffsetSetResp: function(info) {
    var res = {
      raw: info,
    }
    return res;
  },

  // for 04 (response?) - never seen one; maybe happens once per day or at initial startup?
  parseTimeRequest: function(info) {
    return {
      timerequest: true,
      raw: info,
    };
  },

  // for 21 responses
  // contains schedule information for a requested day
  parseScheduleReqResp: function(info) {
    var day = {
      day: info[1],
      segments: [],
    };
    for (var i = 2; i < info.length; i += 2) {
      var segment = {
        temp: info[i] / 2,
        endtime: {
          hour: ((info[i + 1] * 10) / 60) >> 0,
          min: ((info[i + 1] * 10) % 60) >> 0,
        }
      };
      day.segments.push(segment);
    }
    return {
      raw: info,
      dayschedule: day
    }
  },

  // for A0 responses - don't ask how these work :).  never seen one
  parseStartFirmwareUpdate: function(info) {
    // start firmware update
    return {
      firwareupdate: true,
      raw: info,
    };
  },

  // for A1 responses - don't ask how these work :).  never seen one
  parseContinueFirmwareUpdate: function(info) {
    switch (info[1]) {
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
      firwareupdate: true,
      raw: info,
    };
  },

  // read any return, and convert to a javascript structure
  // main oare function, which then defers to fiunctions above as required.
  parseInfo: function(info) {
    try {
      switch (info[0]) {
        case 0:
          return this.parseInfo_0(info);
        case 1:
          return this.parseSysInfo(info);
        case 2:
          switch (info[1] & 0xf) {
            case 1:
              return this.parseStatus(info); // contains status
            case 2:
              return this.parseScheduleSetResp(info); // schedule set response, returns day set
              break;
          }
          if (info[1] == 0x80) {
            return this.parseTempOffsetSetResp(info);
          }
          break;
        case 4:
          return this.parseTimeRequest(info); // time request?
        case 0x21:
          return this.parseScheduleReqResp(info); // response to a schedule request
        case 0xa0:
          return this.parseStartFirmwareUpdate(info);
        case 0xa1:
          return this.parseContinueFirmwareUpdate(info);
          break;
      }

    } catch (e) {
      return {
        error: e.toString(),
        raw: info
      };
    }

    // if we got here, command was not recognised or parsed
    return {
      unknown: true,
      raw: info,
    };

  }, // end parseInfo
  // end of response parse functions.
  ////////////////////////////////////////////////
}