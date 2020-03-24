var _rawData = null;
var _popData = null;
var dateColumns = [];
var _client_width = -1;



$(window).resize(function () {
  if (_rawData != null) {
    console.log("Window size changed -- resizing graphs.");
    var new_width = $("#sizer").width();
    if (_client_width != new_width) {
      render( charts['countries'] );
      render( charts['states'] );
      render( charts['countries-normalized'] );
      render( charts['states-normalized'] );
    }
  }
});


var reducer_byUSstate = function(result, value, key) {
  var states = [
    ['Arizona', 'AZ'],
    ['Alabama', 'AL'],
    ['Alaska', 'AK'],
    ['Arkansas', 'AR'],
    ['California', 'CA'],
    ['Colorado', 'CO'],
    ['Connecticut', 'CT'],
    ['Delaware', 'DE'],
    ['Florida', 'FL'],
    ['Georgia', 'GA'],
    ['Hawaii', 'HI'],
    ['Idaho', 'ID'],
    ['Illinois', 'IL'],
    ['Indiana', 'IN'],
    ['Iowa', 'IA'],
    ['Kansas', 'KS'],
    ['Kentucky', 'KY'],
    ['Louisiana', 'LA'],
    ['Maine', 'ME'],
    ['Maryland', 'MD'],
    ['Massachusetts', 'MA'],
    ['Michigan', 'MI'],
    ['Minnesota', 'MN'],
    ['Mississippi', 'MS'],
    ['Missouri', 'MO'],
    ['Montana', 'MT'],
    ['Nebraska', 'NE'],
    ['Nevada', 'NV'],
    ['New Hampshire', 'NH'],
    ['New Jersey', 'NJ'],
    ['New Mexico', 'NM'],
    ['New York', 'NY'],
    ['North Carolina', 'NC'],
    ['North Dakota', 'ND'],
    ['Ohio', 'OH'],
    ['Oklahoma', 'OK'],
    ['Oregon', 'OR'],
    ['Pennsylvania', 'PA'],
    ['Rhode Island', 'RI'],
    ['South Carolina', 'SC'],
    ['South Dakota', 'SD'],
    ['Tennessee', 'TN'],
    ['Texas', 'TX'],
    ['Utah', 'UT'],
    ['Vermont', 'VT'],
    ['Virginia', 'VA'],
    ['Washington', 'WA'],
    ['West Virginia', 'WV'],
    ['Wisconsin', 'WI'],
    ['Wyoming', 'WY'],
  ];

  var stateDict = {};
  for (i = 0; i < states.length; i++) {
    var s = states[i];
    stateDict[ s[1] ] = s[0];
  }

  country = value["Country/Region"];
  state = value["Province/State"];

  if (country != "United States") { return result; }
  if (state.indexOf("Princess") != -1) { return result; }
  if (state.indexOf(",") != -1 && state.length > 2) {
    var abbr = state[ state.length - 2 ] + state[ state.length - 1 ];
    state = stateDict[abbr];
  }

  // Use the state name as key
  key = state;

  if (!result[key]) { result[key] = {} }
  let obj = result[key];

  for (var i = 0; i < dateColumns.length; i++) {
    var column = dateColumns[i];
    if (!obj[column]) { obj[column] = 0; }
    obj[column] = obj[column] + (+value[column]);
  }

  return result;
};


var reducer_byCountry = function(result, value, key) {
  key = value["Country/Region"];

  if (!result[key]) { result[key] = {} }
  let obj = result[key];

  for (var i = 0; i < dateColumns.length; i++) {
    var column = dateColumns[i];
    if (!obj[column]) { obj[column] = 0; }
    obj[column] = obj[column] + (+value[column]);
  }

  return result;
};



var charts = {
  'countries': {
    reducer: reducer_byCountry,
    scale: "log",
    highlight: "United States",
    y0: 100,
    xCap: 25,
    id: "chart-countries",
    normalizePopulation: false,
    show: 40,
    sort: function (d) { return -d.maxCases; },
    xMax: null, yMax: null, data: null
  },
  'states': {
    reducer: reducer_byUSstate,
    scale: "log",
    highlight: "Illinois",
    y0: 20,
    xCap: 40,
    id: "chart-states",
    normalizePopulation: false,
    show: 9999,
    sort: function (d) { return -d.maxCases; },
    xMax: null, yMax: null, data: null
  },

  'countries-normalized': {
    reducer: reducer_byCountry,
    scale: "log",
    highlight: "United States",
    y0: 1,
    xCap: 25,
    id: "chart-countries-normalized",
    normalizePopulation: "country",
    show: 40,
    sort: function (d) { return -d.maxCases + -(d.pop / 1e6); },
    xMax: null, yMax: null, data: null
  },
  'states-normalized': {
    reducer: reducer_byUSstate,
    scale: "log",
    highlight: "Illinois",
    y0: 1,
    xCap: 40,
    id: "chart-states-normalized",
    normalizePopulation: "state",
    show: 9999,
    sort: function (d) { return -d.maxCases; },
    xMax: null, yMax: null, data: null
  },
};

var findNextExp = function(x) {
  var pow10 = Math.pow(10, Math.ceil( Math.log10(x) ));

  if (x < pow10 / 2) { return pow10 / 2; }
  else { return pow10; }
};

var prep_data = function(chart) {
  var caseData = chart.fullData;

  if (chart.show < 9999) { caseData = _.take(caseData, chart.show); }
  var countries = _.map(caseData, 'country').sort();

  var $highlight = $("#highlight-" + chart.id);
  $highlight.html("");
  $.each(countries, function() {
    var el = $("<option />").val(this).text(this);
    if (chart.highlight == this) { el.attr("selected", true); }
    $highlight.append(el);
  });

  $highlight.change(function (e) {
    chart.highlight = $(e.target).val();
    render(chart);
  });

  chart.data = caseData;
  return chart;
};


var process_data = function(data, chart) {
  var agg = _.reduce(data, chart.reducer, {});

  var caseData = [];
  var maxDayCounter = 0;  
  
  for (var country in agg) {
    var popSize = -1;
    if (chart.normalizePopulation) {
      popSize = _popData[chart.normalizePopulation][country];

      if (!popSize && location.hostname === "localhost") {
        console.log("Missing " + chart.normalizePopulation + ": " + country);
      }
    } 

    dayCounter = -1;
    maxCases = 0;
    countryData = [];
    for (const date of dateColumns) {
      // Start counting days only after the first day w/ 100 cases:
      var cases = agg[country][date];
      if (chart.normalizePopulation) { cases = (cases / popSize) * 1e6; }

      if (dayCounter == -1 && cases >= chart.y0) {
        dayCounter = 0;

        if (country == "China") {
          var factor = 1;
          if (chart.normalizePopulation) { factor = 1e6 / popSize; }

          // Add in missing early data, sourced from Wikipedia
          if (121 * factor >= chart.y0) {
            if (dateColumns.indexOf("1/18/20") == -1) { countryData.push({ country: country, dayCounter: dayCounter++, date: "1/18/20", cases: 121 * factor }); }
          }
          if (198 * factor >= chart.y0) {
            if (dateColumns.indexOf("1/19/20") == -1) { countryData.push({ country: country, dayCounter: dayCounter++, date: "1/19/20", cases: 198 * factor }); }
          }
          if (291 * factor >= chart.y0) {
            if (dateColumns.indexOf("1/20/20") == -1) { countryData.push({ country: country, dayCounter: dayCounter++, date: "1/20/20", cases: 291 * factor }); }
          }
          if (440 * factor >= chart.y0) {
            if (dateColumns.indexOf("1/21/20") == -1) { countryData.push({ country: country, dayCounter: dayCounter++, date: "1/21/20", cases: 440 * factor }); }
          }

          
        }
      }
      
      // Once we start counting days, add data
      if (dayCounter > -1) {
        countryData.push({
          pop: popSize,
          country: country,
          dayCounter: dayCounter,
          date: date,
          cases: cases
        });
        if (cases > maxCases) { maxCases = cases; }

        dayCounter++;
      }
    }

    if (dayCounter > 0) {
      caseData.push({
        pop: popSize,
        country: country,
        data: countryData,
        maxCases: maxCases,
        maxDay: dayCounter - 1
      });

      if (dayCounter > maxDayCounter) {
        maxDayCounter = dayCounter + 2;
      }
    }
  }
  
  caseData = _.sortBy(caseData, chart.sort);
  chart.fullData = caseData;

  casesMax = _.sortBy(caseData, function(d) { return -d.maxCases; } )[0];
  console.log(caseData);
  console.log(casesMax);
  chart.yMax = findNextExp(casesMax.maxCases);

  chart.xMax = maxDayCounter;
  if (chart.xMax > 40) { chart.xMax = 40; }

  return prep_data(chart);
};






$(function() {
  $(".scaleSelection").mouseup(function(e) {
    var value = $(e.target).data("scale");
    var chartId = $(e.target).data("chart");
    var chart = charts[chartId];

    if (chart && chart.scale != value) {
      chart.scale = value;
      render(chart);
    }
  });

  $(".filter-select").change(function (e) {
    console.log("Filter select;")
    var chartId = $(e.target).data("chart");
    var chart = charts[chartId];
    
    chart.show = $(e.target).val();
    prep_data(chart);
    render(chart);
  });



  var x = d3.csv("time_series_19-covid-Confirmed.csv?d=20200322", function (row) {
      var country = row["Country/Region"];
      if (country == "US") { country = "United States"; }
      else if (country == "Korea, South") { country = "South Korea"; }
      else if (country == "Taiwan*") { country = "Taiwan"; }
      else if (country == "Bahamas, The") { country = "Bahamas"; }
      else if (country == "Gambia, The") { country = "Gambia"; }
      else if (country == "The Bahamas") { country = "Bahamas"; }
      else if (country == "The Gambia") { country = "Gambia"; }
      else if (country == "Cabo Verde") { country = "Cape Verde"; }
      else if (country == "Congo (Brazzaville)") { country = "Republic of the Congo"; }
      row["Country/Region"] = country;

      var state = row["Province/State"];
      if (state == "United States Virgin Islands") { state = "Virgin Islands"; }
      row["Province/State"] = state;

      return row;
    })
    .then(function (data) {

      d3.csv("wikipedia-population.csv", function (row) {
        row["Population"] = (+row["Population"]);
        return row;
      })
      .then(function (populationData) {
        _rawData = data;

        _popData = {country: {}, state: {}};
        for (var pop of populationData) {
          if (pop.Country) { _popData.country[pop.Country] = pop.Population; }
          if (pop.State) { _popData.state[pop.State] = pop.Population; }
        }
        //console.log(_popData);
        //_popData = populationData;

        dateColumns = data.columns.slice(4);
  
        process_data(data, charts["countries"]);
        render(charts["countries"]);
  
        process_data(data, charts["states"]);
        render(charts["states"]);
        
        process_data(data, charts["countries-normalized"]);
        render(charts["countries-normalized"]);
  
        process_data(data, charts["states-normalized"]);
        render(charts["states-normalized"]);

      });

    })
    .catch(function (err) {
      console.error(err);
      alert("Failed to load data.")
    });
});


var tip_html = function(chart) {
  return function(d, i) {
    var geometicGrowth = Math.pow(d.cases / chart.y0, 1 / d.dayCounter);

    var s2 = "";
    if (chart.normalizePopulation) { s2 = " per 1,000,000 people"; }

    return `<div class="tip-country">${d.country} &ndash; Day ${d.dayCounter}</div>
            <div class="tip-details" style="border-bottom: solid 1px black; padding-bottom: 2px;"><b>${d.cases.toLocaleString()}</b> confirmed cases${s2} on ${d.date} (<b>${d.dayCounter}</b> days after reaching ${chart.y0} cases${s2})</div>
            <div class="tip-details"><i>Avg. geometric growth: <b>${geometicGrowth.toFixed(2)}x</b> /day</i></div>`;
  }
};

var render = function(chart) {
  var maxDayRendered = chart.xMax;
  var margin = { top: 10, right: 20, bottom: 40, left: 80 };

  var cur_width = $("#sizer").width();
  _client_width = cur_width;

  var width = cur_width - margin.right - margin.left;
  var height = 500;

  var isSmall = false;
  if (width < 400) {
    height = 300;
    isSmall = true;
  }

  // X-axis scale (days)
  var daysScale = d3.scaleLinear()
                    .domain([0, maxDayRendered])
                    .range([0, width]);

  // Y-axis scale (# of cases)                    
  var casesScale;
  if (chart.scale == "log") { casesScale = d3.scaleLog(); }
  else { casesScale = d3.scaleLinear(); }
  casesScale.domain([chart.y0, chart.yMax]).range([height, 0]);
  
  // Color Scale
  var colorScale = d3.scaleOrdinal(d3.schemeCategory10);

  // SVG
  $("#" + chart.id).html("");
  var svg = d3.select("#" + chart.id)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .style("width", width + margin.left + margin.right)
    .style("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Mouseovers
  var tip = d3.tip().attr('class', 'd3-tip').html(tip_html(chart));
  svg.call(tip);

  // Axes
  var x_axis = d3.axisBottom(daysScale);
  svg.append('g')
     .attr("transform", "translate(0, " + height + ")")
     .attr("class", "axis")
     .call(x_axis);  
  
  var x_grid = d3.axisBottom(daysScale).tickSize(-height).tickFormat("");
  svg.append('g')
     .attr("transform", "translate(0, " + height + ")")
     .attr("class", "grid")
     .call(x_grid);

  // Have tickValues at 1, 5, 10, 50, 100, ...
  var tickValue = 1;
  var tickValueIncrease = 5; 
  var tickValues = [];
  while (tickValue <= 1e6) {
    if (tickValue >= chart.y0) { tickValues.push(tickValue); }
    tickValue *= tickValueIncrease;

    if (tickValueIncrease == 5) { tickValueIncrease = 2; }
    else { tickValueIncrease = 5; }
  }

  var y_axis = d3.axisLeft(casesScale).tickFormat(d3.format("0,")); 
  if (chart.scale == "log") { y_axis.tickValues(tickValues); }
  
  svg.append('g')
    .attr("class", "axis")
    .call(y_axis);  

  var y_grid = d3.axisLeft(casesScale).tickSize(-width).tickFormat("");
  svg.append('g')
     .attr("class", "grid")
     .call(y_grid);
    


  // Add Data

  // Create 35%-line
  var cases = chart.y0, day = 0;
  var pctLine = [];
  while (cases < 2 * chart.yMax) {
    pctLine.push({
      dayCounter: day,
      cases: cases
    })

    day++;
    cases *= 1.35;
  }

  svg.datum(pctLine)
    .append("path")
    .attr("fill", "none")
    .attr("stroke", "black")
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", 12)
    .attr("d", d3.line()
      .x(function (d) { return daysScale(d.dayCounter); })
      .y(function (d) { return casesScale(d.cases); })
    );

  svg.append("text")
    .attr("fill", colorScale(i))
    .attr("class", "label-country")
    .attr("x", daysScale( Math.log( chart.yMax / chart.y0 ) ) / Math.log( 1.35 ) + 2 )
    .attr("y", casesScale( chart.yMax ) + 12 )
    .attr("fill", "black")
    //.attr("alignment-baseline", "middle")    
    .text((!isSmall) ? "1.35x daily growth" : "1.35x daily");

  svg.append("text")
     .attr("x", width - 5)
     .attr("y", height - 5)
     .attr("class", "axis-title")
     .attr("text-anchor", "end")
     .text( (chart.normalizePopulation) ? `Days since ${chart.y0} case /1m people` : "Days since " + chart.y0 + "+ cases");

  svg.append("text")
     .attr("transform", "rotate(-90)")
     .attr("x", -2)
     .attr("y", 15)
     .attr("class", "axis-title")
     .attr("text-anchor", "end")
     .text( (chart.normalizePopulation) ? "Confirmed Cases /1m people" : "Confirmed Cases of COVID-19");

  svg.append("text")
    .attr("x", width)
    .attr("y", height + 32)
    .attr("class", "text-credits")
    .attr("text-anchor", "end")
    .text(`Data Source: Johns Hopkins CSSE; Updated: ${_dateUpdated}`);

  /*
  svg.append("text")
    .attr("x", width)
    .attr("y", height + 32)
    .attr("text-anchor", "end")
    .attr("class", "text-credits")
    .text("A 91-DIVOC project to \"flip the script\" on COVID-19.  By: @profwade_");
  */

  last_index = -1;
  for (var i = 0; i < chart.data.length; i++) {
    colorScale(i);
    if (chart.data[i].data[0].country == chart.highlight) {
      last_index = i;
    }
  }

  var renderLineChart = function(svg, i) {
    var countryData = chart.data[i];

    svg.datum(countryData.data)
      .append("path")
      .attr("fill", "none")
      .attr("stroke", colorScale(i) )
      .attr("stroke-width", function (d) {
        if (d[0].country == chart.highlight) { return 4; }
        else { return 1; }
      })
      .style("opacity", function (d) {
        if (d[0].country == chart.highlight) { return 1; }
        else { return 0.3; }
      })      
      .attr("d", d3.line()
        .x(function (d) { return daysScale(d.dayCounter); })
        .y(function (d) { return casesScale(d.cases); })
      );

    svg.selectAll("countries")
      .data(countryData.data)
      .enter()
      .append("circle")
      .attr("cx", function (d) { return daysScale(d.dayCounter); } )
      .attr("cy", function (d) { return casesScale(d.cases); } )
      .style("opacity", function (d) {
        if (d.country == chart.highlight) { return 1; }
        else { return 0.3; }
      })
      .attr("r", function (d) {
        if (d.country == chart.highlight) { return 4; }
        else { return 3; }
      })
      .attr("fill", colorScale(i))
      .on('mouseover', tip.show)
      .on('mouseout', tip.hide);

    var countryText = svg.append("text")
      .attr("fill", colorScale(i))
      .attr("class", "label-country")
      .style("opacity", function () {
        if (countryData.data[0].country == chart.highlight) { return 1; }
        else { return 0.3; }
      })
      .style("font-size", function () {
        if (countryData.data[0].country == chart.highlight) { return "15px"; }
        else { return null; }
      })
      .text(countryData.country);

    if (countryData.maxDay < maxDayRendered) { 
      countryText
        .attr("x", 5 + daysScale(countryData.maxDay) )
        .attr("y", casesScale(countryData.maxCases) )
        .attr("alignment-baseline", "middle")
    } else {
      countryText
        .attr("x", daysScale(maxDayRendered) - 5 )
        .attr("y", casesScale(countryData.data[maxDayRendered - 1].cases) - 5 )
        .attr("text-anchor", "end")
    }
  };

  for (var i = 0; i < chart.data.length; i++) {
    if (i != last_index) { renderLineChart(svg, i); }
  }

  if (last_index != -1) {
    renderLineChart(svg, last_index);
  }



};