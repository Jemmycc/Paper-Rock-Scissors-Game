// Initialize Firebase
var config = {
    apiKey: "AIzaSyCtDvRUiZzdZgPaJlChfpMuIF6Ogu4QMIk",
    authDomain: "prs-game.firebaseapp.com",
    databaseURL: "https://prs-game.firebaseio.com",
    projectId: "prs-game",
    storageBucket: "prs-game.appspot.com",
    messagingSenderId: "365440898388"
};

firebase.initializeApp(config);

// Create a variable to reference the database.
var database = firebase.database();

//create a variable for a chat database
var chatData = database.ref("/chat");

var playersRef = database.ref("players");
var currentTurnRef = database.ref("turn");

var username = "Guest";

var currentPlayers = null;
var currentTurn = null;

var playerNum = false;

var playerOneExists = false;
var playerTwoExists = false;

var playerOneData = null;
var playerTwoData = null;

//username listeners
// takes username and tries to get user in game while clicking the button

$("#add-user").click(function () {
    if ($("#username").val() !== "") {
        username = capitalize($("#username").val());
        getInGame();
    }
});

//listener for 'enter' in username input
$("#username").keypress(function (e) {
    if (e.which === 13 && $("#username").val() !== "") {
        username = capitalize($("#username").val());
        getInGame();
    }
});

//function to capitalize usernames
function capitalize(name) {
    return name.charAt(0).toUpperCase() + name.slice(1);
}

//chat listeners
//chat send button listener, grabs input and pushes to firebase.
$("#chat-send").click(function () {
    if ($("#chat-input").val() !== "") {
        var message = $("#chat-input").val();

        chatData.push({
            name: username,
            message: message,
            time: firebase.database.ServerValue.TIMESTAMP,
            idNum: playerNum
        });
        $("#chat-input").val("");
    }
});

// Chatbox input listener
$("#chat-input").keypress(function (e) {
    if (e.which === 13 && $("#chat-input").val() !== "") {
        var message = $("#chat-input").val();

        chatData.push({
            name: username,
            message: message,
            time: firebase.database.ServerValue.TIMESTAMP,
            idNum: playerNum
        });
        $("#chat-input").val("");
    }
});

function makeGuess(clickChoice) {
    console.log(clickChoice);
    console.log(playerRef);

    //sets the choice in the current player object in firebase
    playerRef.child("choice").set(clickChoice);

    //increments turn, turn goese form:
    // 1 - player 1
    // 2 - player 2
    // 3 - determine winner 
    currentTurnRef.transaction(function (turn) {
        return turn + 1;
    });
}

//update chat on screen when new message detected - ordered by "time" value
chatData.orderByChild("time").on("child_added", function (snapshot) {
    $("#chat-messages").append(
        $("<p>").addClass("player-" + snapshot.val().idNum),
        $("<span>").text(snapshot.val().name + ": " + snapshot.val().message)
    );

    //keeps div scrolled to bottom on each update
    $("#chat-messages").scrollTop($("#chat-messages")[0].scrollHeight);
});

//track changes in key which contains player objects
playersRef.on("value", function (snapshot) {

    //length of the 'players' array
    currentPlayers = snapshot.numChildren();

    //check to see if players exist
    playerOneExists = snapshot.child("1").exists();
    playerTwoExists = snapshot.child("2").exists();

    // Player data objects
    playerOneData = snapshot.child("1").val();
    playerTwoData = snapshot.child("2").val();

    // if there is a player 1, fill in name and win loss data
    if (playerOneExists) {
        $("#player1-name").text(playerOneData.name);
        $("#player1-states").text(playerOneData.wins);
    } else {
        //if there is no player 1, clear the data and show waiting
        $("#player1-name").text("Waiting for Player 1");
        $("#player1-states").empty();
    }

    // if there is a player 2, fill in name and win loss data
    if (playerTwoExists) {
        $("#player2-name").text(playerTwoData.name);
        $("#player2-states").text(playerTwoData.wins);
    } else {
        //if there is no player 2, clear the data and show waiting
        $("#player2-name").text("Waiting for Player 2");
        $("#player2-states").empty();
    }
});

//detects changes in current turn key
currentTurnRef.on("value", function (snapshot) {

    //gets current turn from snapshot
    currentTurn = snapshot.val();

    //dont do the following unless you are logged in
    if (playerNum) {

        //for turn 1
        if (currentTurn === 1) {

            //if its the current player's turn, tell them and show choices
            if (currentTurn === playerNum) {
                $("#current-turn h4").text("It's your turn!");
            } else {
                //if it's not the current players turn, tell them they're waiting for player one.
                $("#current-turn h4").text("waiting for " + playerOneData.name + " to choose.");
            }
            //shows yellow border around active player
            $("#player1").css("border", "3px solid yellow");
            $("#player2").css("border", "1px solid black");

        } else if (currentTurn === 2) {

            //if its the current player's turn, tell them and show choices
            if (currentTurn === playerNum) {
                $("#current-turn h4").text("It's your turn!");
            } else {
                //if it's not the current players turn, tells them they're waiting for player two
                $("#current-turn h4").text("waiting for " + playerTwoData.name + " to choose.");
            }
            //shows yellow border around active player 
            $("#player2").css("border", "3px solid yellow");
            $("#player1").css("border", "1px solid black");

        } else if (currentTurn === 3) {

            //where the game win logic takes place then resets to turn1
            gameLogic(playerOneData.choice, playerTwoData.choice);

            //reset after timeout
            var moveOn = function () {
                $("#result").empty();
                $(".choices").show();

                //check to make sure players didn't leave before timeout
                if (playerOneExists && playerTwoExists) {
                    currentTurnRef.set(1);
                }
            };

            //show results for 2 seconds, then resets
            setTimeout(moveOn, 2000);
        } else {
            $("#current-turn").html("<h4>Waiting for another player to join.</h4>");
            $("#player2").css("border", "1px solid black");
            $("#player1").css("border", "1px solid black");
        }
    }

});

//when a player joins, checks to see if there are two players now. if yes, then starts the game.
playersRef.on("child_added", function (snapshot) {

    if (currentPlayers === 1) {

        //set turn to 1, which starts the game
        currentTurnRef.set(1);
    }
});

//function to get in the game
function getInGame() {

    //for adding disconnects to teh chat with a unique id (the date/time the user entered the game)
    //needed becasue firebase's ".push()" creates its unique keys client side.
    //so you can't ".push()" in a ".onDisconnect"
    var chatDataDisc = database.ref("/chat/" + Date.now());

    //checks for current players, if there is a player one connected, then the user becomes player two.
    if (currentPlayers < 2) {

        if (playerOneExists) {
            playerNum = 2;
            $("#button2-s").click(function () {
                makeGuess("Scissors");
            });

            $("#button2-r").click(function () {
                makeGuess("Rock");
            });

            $("#button2-p").click(function () {
                makeGuess("Paper");
            });
        } else {
            playerNum = 1;
            $("#button1-s").click(function () {
                makeGuess("Scissors");
            });

            $("#button1-r").click(function () {
                makeGuess("Rock");
            });

            $("#button1-p").click(function () {
                makeGuess("Paper");
            });
        }

        //creates key based on assigned player number
        playerRef = database.ref("/players/" + playerNum);

        //create player object. "choice" is not unnecessary here, but I left it in to be as complete as possible
        playerRef.set({
            name: username,
            wins: 0,
            losses: 0,
            choice: null
        });

        //on disconnect remove this user's player object
        playerRef.onDisconnect().remove();

        //if a user disconnects, set the current turn to "null" so the game does not continue
        currentTurnRef.onDisconnect().remove();

        //send discouuect message to chat with firebase server generated timestamp and id of "0" to denote system message
        chatDataDisc.onDisconnect().set({
            name: username,
            time: firebase.database.ServerValue.TIMESTAMP,
            message: "has disconnected.",
            idNum: 0
        });

        //remove name input box and show current player number
        $("#swap-name").empty();

        $("#swap-name").append($("<h2>").text("Hi, " + username + "! You're player" + playerNum));
    } else {
        //if current player is "2", will not allow the player to join
        alert("Sorry, Game full! Try again later.");
    }
}

//game logic. display who won, lost, or tie game
//increments wins or losses accordingly
function gameLogic(player1Choice, player2Choice) {
    var playerOneWon = function () {
        $("#result").text(playerOneData.name + " Wins!");

        if (playerNum === 1) {
            playersRef
                .child("1")
                .child("wins")
                .set(playerOneData.wins + 1);
            playersRef
                .child("2")
                .child("losses")
                .set(playerTwoData.losses + 1);
        }
    };

    var playerTwoWon = function () {
        $("#result").text(playerTwoData.name + " Wins!");

        if (playerNum === 2) {
            playersRef
                .child("2")
                .child("wins")
                .set(playerTwoData.wins + 1);
            playersRef
                .child("1")
                .child("losses")
                .set(playerOneData.losses + 1);
        }
    };

    var tie = function () {
        $("#result").text("Tie Game!");
    };

    if (player1Choice === "Rock" && player2Choice === "Rock") {
        tie();
        $("#button1-p").hide();
        $("#button1-s").hide();
        $("#button2-p").hide();
        $("#button2-s").hide();
    } else if (player1Choice === "Paper" && player2Choice === "Paper") {
        tie();
        $("#button1-r").hide();
        $("#button1-s").hide();
        $("#button2-r").hide();
        $("#button2-s").hide();
    } else if (player1Choice === "Scissors" && player2Choice === "Scissors") {
        tie();
        $("#button1-p").hide();
        $("#button1-r").hide();
        $("#button2-p").hide();
        $("#button2-r").hide();
    } else if (player1Choice === "Rock" && player2Choice === "Paper") {
        playerTwoWon();
        $("#button1-p").hide();
        $("#button1-s").hide();
        $("#button2-r").hide();
        $("#button2-s").hide();
    } else if (player1Choice === "Rock" && player2Choice === "Scissors") {
        playerOneWon();
        $("#button1-p").hide();
        $("#button1-s").hide();
        $("#button2-r").hide();
        $("#button2-p").hide();
    } else if (player1Choice === "Paper" && player2Choice === "Rock") {
        playerOneWon();
        $("#button1-r").hide();
        $("#button1-s").hide();
        $("#button2-p").hide();
        $("#button2-s").hide();
    } else if (player1Choice === "Paper" && player2Choice === "Scissors") {
        playerTwoWon();
        $("#button1-r").hide();
        $("#button1-s").hide();
        $("#button2-r").hide();
        $("#button2-p").hide();
    } else if (player1Choice === "Scissors" && player2Choice === "Rock") {
        playerTwoWon();
        $("#button2-p").hide();
        $("#button2-s").hide();
        $("#button1-r").hide();
        $("#button1-p").hide();
    } else if (player1Choice === "Scissors" && player2Choice === "Paper") {
        playerOneWon();
        $("#button1-p").hide();
        $("#button1-r").hide();
        $("#button2-r").hide();
        $("#button2-s").hide();
    }
}
