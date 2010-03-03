require.paths.unshift("./lib");

require("picard");
var sys = require("sys");
var fs = require("fs");

var settings = JSON.parse(fs.readFileSync("settings.json"));

picard.env = settings.picard_env;

picard.start();

var hostname = "";
sys.exec("hostname", function(a,b,c) {
  hostname = b.replace("\n", "");
});
var features = {};
var call_stats = {
  last_60_minutes: [],
  last_60_seconds: []
};
var insert_call = function() {
  var second = (new Date()).getSeconds();
  var second_ts = Math.floor((new Date()).getTime() / 1000);
  if (!call_stats.last_60_seconds[second]) {
    call_stats.last_60_seconds[second] = {
      ts: second_ts,
      calls: 0
    };
  }
  if (call_stats.last_60_seconds[second].ts != second_ts) {
    call_stats.last_60_seconds[second].ts = second_ts;
    call_stats.last_60_seconds[second].calls = 0;
  }
  call_stats.last_60_seconds[second].calls += 1;

  var minute = (new Date()).getMinutes();
  var minute_ts = Math.floor((new Date()).getTime() / 60000);

  if (!call_stats.last_60_minutes[minute]) {
    call_stats.last_60_minutes[minute] = {
      ts: minute_ts,
      calls: 0
    };
  }
  if (call_stats.last_60_minutes[minute].ts != minute_ts) {
    call_stats.last_60_minutes[minute].ts = minute_ts;
    call_stats.last_60_minutes[minute].calls = 0;
  }
  call_stats.last_60_minutes[minute].calls += 1;
};

var formatResponse = function(request, data) {
  insert_call();
  return JSON.stringify({
    status: 0,
    msg: "",
    request: request.url,
    timestamp: new Date().toString(),
    nodename: hostname,
    nodeID: 0,
    data: data
  });
};

var reload = function() {
  sys.puts("reloading feature file");
  try {
    features = JSON.parse(fs.readFileSync(settings.feature_file));
    sys.puts("feature file reloaded");
  } catch(e) {
    sys.puts("feature file reload failed");
    return save();
  }
  return true;
};

var save = function() {
  sys.puts("saving feature file");
  try {
    fs.writeFileSync("features.json", JSON.stringify(features));
    sys.puts("feature file saved");
  } catch(e) {
    sys.puts("feature file save failed");
    return false;
  }
  return true;
};

reload();

if (0 < settings.poll_feature_file) {
  setInterval(reload, settings.poll_feature_file);
}

var list = function(request) {
  return formatResponse(request, {
    features: features,
    success: true
  });
};

var getKey = function(request) {
  if (features.hasOwnProperty(request.key)) {
    return formatResponse(request, {
      key: request.key,
      values: features[request.key],
      success: true
    });
  }
  return formatResponse(request, {
    success: false
  });
};

var setKGP = function(request) {
  if (!features.hasOwnProperty(request.key)) {
    features[request.key] = [];
  }
  for (var i = 0, found = false; i < features[request.key].length; i += 1) {
    if (features[request.key][i][0] === parseInt(request.group)) {
      found = true;
      features[request.key][i][1] = parseInt(request.percent);
    }
  }
  if (!found) {
    features[request.key].push([parseInt(request.group), parseInt(request.percent)]);
  }
  return formatResponse(request, {
    success: save()
  });
};

var clearKeyGroup = function(request) {
  if (!features.hasOwnProperty(request.key)) {
    for (var i = 0; i < features[request.key].length; i += 1) {
      if (features[request.key][i][0] === parseInt(request.group)) {
        features[request.key].splice(i, 1);
        return formatResponse(request, {
          success: save()
        });
      }
    }
  }
  return formatResponse(request, {
    success: false
  });
};

var clearKey = function(request) {
  if (!features.hasOwnProperty(request.key)) {
    features[request.key] = null;
    delete features[request.key];
    return formatResponse(request, {
    success: save()
  });
  }
  return formatResponse(request, {
    success: false
  });
};

var ping = function(request) {
  return formatResponse(request, {
    success: true
  });
};

var stats = function(request) {
  var min_second_ts = Math.floor((new Date()).getTime() / 1000) - 60;
  var min_minute_ts = Math.floor((new Date()).getTime() / 60000) - 60;
  var oldest_second = 0, oldest_minute = 0;
  
  for(var i = 0; i < 60; i += 1) {
    if (call_stats.last_60_seconds[i]) {
      if (call_stats.last_60_seconds[i].ts < min_second_ts) {
        call_stats.last_60_seconds[i].calls = 0;
      } else if (!call_stats.last_60_minutes[oldest_second] || call_stats.last_60_seconds[i].ts < call_stats.last_60_seconds[oldest_second].ts) {
        oldest_second = i;
      }
    }
    if (call_stats.last_60_minutes[i]) {
      if (call_stats.last_60_minutes[i].ts < min_minute_ts) {
        call_stats.last_60_minutes[i].calls = 0;
      } else if (!call_stats.last_60_minutes[oldest_minute] || call_stats.last_60_minutes[i].ts < call_stats.last_60_minutes[oldest_minute].ts) {
        oldest_minute = i;
      }
    }
  }
  
  var last_60_minutes = [], last_60_seconds = [];
  var avg_rps = 0, avg_rpm = 0;

  // TODO: my math here is wrong
  for(i = 0; i < 60; i += 1) {
    if (call_stats.last_60_seconds[i]) {
      last_60_seconds[60 - (i - oldest_second) % 60] = call_stats.last_60_seconds[i].calls;
      avg_rps += call_stats.last_60_seconds[i].calls;
    } else {
      last_60_seconds[60 - (i - oldest_second) % 60] = 0;
    }
    if (call_stats.last_60_minutes[i]) {
      last_60_minutes[60 - (i - oldest_minute) % 60] = call_stats.last_60_minutes[i].calls;
      avg_rpm += call_stats.last_60_minutes[i].calls;
    } else {
      last_60_minutes[60 - (i - oldest_minute) % 60] = 0;
    }
  }
  
  return formatResponse(request, {
    //raw: call_stats,
    last_60_seconds: last_60_seconds,
    last_60_minutes: last_60_minutes,
    avg_rps: avg_rps / 60,
    avg_rpm: avg_rpm / 60,
    success: true
  });
};

get("/list/?", list);
get("/get/:key/?", getKey);
get("/set/:key/:group/:percent/?", setKGP);
get("/clear/:key/:group/?", clearKeyGroup);
get("/clear/:key/?", clearKey);
put("/:key/:group/:percent/?", setKGP);
del("/:key/:group/?", clearKeyGroup);
del("/:key/?", clearKey);
get("/service_ping", ping);
get("/stats", stats);