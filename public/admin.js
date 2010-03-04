$(function() {
  $("a.add").click(function(ev){
    ev.preventDefault();
    if ($("#new_feature_name").val() !== "") {
      $.getJSON("/add/" + $("#new_feature_name").val(), function() {
        $.getJSON("/set_percent/" + $("#new_feature_name").val() + "/rollout/" + ($("#new_feature_percent").val() || 0), function() {
          var addGroup = function(group) {
            $.getJSON("/add_group/" + $("#new_feature_name").val() + "/" + group, function() {
              if (groups.length) {
                addGroup(groups.pop());
              } else {
                $("#new_feature_name, #new_feature_groups").val("");
                $("#new_feature_percent").val("0");
                document.location.reload();
              }
            });
          };
          var groups = $("#new_feature_groups").val().split(",");
          if (groups.length && groups[0] !== "") {
            addGroup(groups.pop());
          } else {
            $("#new_feature_name, #new_feature_groups").val("");
            $("#new_feature_percent").val("0");
            document.location.reload();
          }
        });
      });
    }
  });
  $("a.remove").click(function(ev){
    ev.preventDefault();
    $.getJSON("/remove/" + $(this).prevAll("span").text(), function() {
      document.location.reload();
    });
  });
  $("div").find(":last").each(function(){
    var old_values = $(this).val().split(","), feature_name = $(this).prevAll("span").text();
    $(this).change(function(ev){
      ev.preventDefault();
      var new_values = $(this).val().split(","), j, removed_values = [], added_values = [];
      for (var i = 0; i < old_values.length; i += 1) {
        j = $.inArray(old_values[i], new_values);
        if (j === -1) {
          removed_values.push(old_values[i]);
        }
      }
      for (i = 0; i < new_values.length; i += 1) {
        j = $.inArray(new_values[i], old_values);
        if (j === -1) {
          added_values.push(new_values[i]);
        }
      }
      var addGroup = function(group) {
        $.getJSON("/add_group/" + feature_name + "/" + group, function() {
          if (added_values.length) {
            addGroup(added_values.pop());
          } else if (removed_values.length) {
            removeGroup(removed_values.pop());
          } else {
            document.location.reload();
          }
        });
      };
      var removeGroup = function(group) {
        $.getJSON("/remove_group/" + feature_name + "/" + group, function() {
          if (removed_values.length) {
            removeGroup(removed_values.pop());
          } else {
            document.location.reload();
          }
        });
      };
      if (added_values.length) {
        addGroup(added_values.pop());
      } else if (removed_values.length) {
        removeGroup(removed_values.pop());
      } else {
        document.location.reload();
      }
    });
  });
});