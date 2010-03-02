require.paths.unshift("./lib");

require("picard");
var sys = require("sys");
var fs = require("fs");

picard.env = {
  root: "/web/feature_service",
  mode: "development",
  port: 9999
};

picard.start();

var features = {};

var formatResponse = function(request, data) {
  return JSON.stringify({
    status: 0,
    msg: "",
    request: request.url,
    timestamp: new Date().toString(),
    nodename: "gilt-ml-kdavis-2",
    nodeID: 0,
    data: data
  });
};

var reload = function(request) {
  try {
    features = JSON.parse(fs.readFileSync("features.json"));
  } catch(e) {
    return save(request);
  }
  if (request) {
    return formatResponse(request, {
      success: true
    });
  }
};

var save = function(request) {
  try {
    fs.writeFileSync("features.json", JSON.stringify(features));
  } catch(e) {
    if (request) {
      return formatResponse(request, {
        success: false
      });
    }
  }
  if (request) {
    return formatResponse(request, {
      success: true
    });
  }
};

reload();

get("/list", function(request) {
  return formatResponse(request, {
    features: features,
    success: true
  });
});

get("/get/:key", function(request) {
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
});

get("/set/:key/:group/:percent", function(request) {
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
  return save();
});

get("/clear/:key/:group", function(request) {
  if (!features.hasOwnProperty(request.key)) {
    for (var i = 0; i < features[request.key].length; i += 1) {
      if (features[request.key][i][0] === parseInt(request.group)) {
        features[request.key].splice(i, 1);
        return save();
      }
    }
  }
  return formatResponse(request, {
    success: false
  });
});

get("/clear/:key", function(request) {
  if (!features.hasOwnProperty(request.key)) {
    features[request.key] = null;
    delete features[request.key];
    return save();
  }
  return formatResponse(request, {
    success: false
  });
});
