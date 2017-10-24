
var data = JSON.parse(data.replace(/&quot;/g,'"'));
console.log(data)
$(function() { 
	var meta = {'erd_id': data.erd_id, 'user': data.email};
	data=data.updates;
	console.log(data.length)
	if(data.length>0){

		var width = 960, height = 500;
		
		var svg = d3.select("#svg").append("svg")
			.style("height", height)
			.style("width", width);

		var margin = {top: 20, right: 20, bottom: 30, left: 50},
		    width = width - margin.left - margin.right,
		    height = height- margin.top - margin.bottom,
		    g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		var parseTime =  d3.utcParse("%Y-%m-%dT%H:%M:%S.%LZ");// d3.timeParse("%d-%b-%y");
			function unixTime(t){
				return parseInt((new Date(t).getTime()).toFixed(0));
			}
		//var start = parseTime(data[0].time), end = parseTime(data[data.length-1].time);
		var start = moment(data[0].time).utc(), end = moment(data[data.length-1].time).utc();
			console.log(start+" : "+end);

		var times = {}, data2=[];
			
			data.forEach(function(d, i){data[i].date = unixTime(d.time); times[data[i].date]=true; });//delete d.time;

			var data2 = [];

			for(var t = data[0].date; t< data[data.length-1].date; t=t+60000){
				if(!times[t]){
			  		data2.push({'date':t, 'value':0});
			  	}
			}

		
			data = data.concat(data2);
			
			data.sort(function(a,b){return a.date>b.date ? -1 : a.date<b.date ? 1 : 0;})

		var x = d3.scaleTime()
		    .rangeRound([0, width]);

		var y = d3.scaleLinear()
		    .rangeRound([height, 0]);

		var z = d3.scaleOrdinal(d3.schemeCategory10);

		var area = d3.area()
		    .x(function(d) { return x(d.date); })
		    .y0(height)
		    .y1(function(d) { return y(d.value); })
		    .curve(d3.curveCardinal);


		  x.domain(d3.extent(data, function(d) { return d.date; }));
		  y.domain(d3.extent(data, function(d) { return d.value; }));

		  g.append("path")
			.datum(data)
			.attr("fill", "blue")
			.attr("stroke", "steelblue")
			.attr("stroke-linejoin", "round")
			.attr("stroke-linecap", "round")
			.attr("stroke-width", 1.5)
			.attr("d", area);

		  g.append("rect")
	  		.attr("x", 0)
	  		.attr("y", height)
	  		.attr("height", 100)
	  		.attr("width", width)
	  		.style("fill", "white");

		  g.append("g")
		      .attr("transform", "translate(0," + height + ")")
		      .call(d3.axisBottom(x)
			      	.ticks(10)
			      	.tickFormat(function(d){return d.getHours()+":"+(d.getMinutes()<10?"0":"")+d.getMinutes();}))
		    .select(".domain")
		      .remove();

		  g.append("g")
		      .call(d3.axisLeft(y))
		    .append("text")
		      .attr("fill", "#000")
		      .attr("transform", "rotate(-90)")
		      .attr("y", 6)
		      .attr("dy", "0.71em")
		      .attr("text-anchor", "end")
		      .text("Price ($)");



	}else{
		console.log("No Data!")
	}
});