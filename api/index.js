const express = require('express');
const cors = require("cors");
require("dotenv").config();
const mongoose = require("mongoose");
const UserModel = require("./models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const path = require("path");
const helmet = require('helmet');

const Ticket = require("./models/Ticket");

const app = express();

const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = "bsbsfbrnsftentwnnwnwn";

app.use(helmet.contentSecurityPolicy({
   directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
   }
}));
app.use(express.json());
app.use(cookieParser());
app.use(
   cors({
      credentials: true,
      origin: "http://localhost:5173",
   })
);

mongoose.connect(process.env.MONGO_URL)
.then(()=>console.log("DB Connected"))
.catch(err=>console.log(err));

const eventSchema = new mongoose.Schema({
   owner: String,
   title: String,
   description: String,
   organizedBy: String,
   eventDate: Date,
   eventTime: String,
   location: String,
   Participants: Number,
   Count: Number,
   Income: Number,
   ticketPrice: Number,
   Quantity: Number,
   likes: Number,
   Comment: [String],
   imageURL: String // New field for storing image URLs
});

const Event = mongoose.model("Event", eventSchema);

app.get('/', (req, res) => {
   Event.find({})
   .then((data, err)=>{
       if(err){
           console.log(err);
       }
       res.render('imagepage',{items: data})
   })
});

app.post("/register", async (req, res) => {
   const { name, email, password } = req.body;

   try {
      const userDoc = await UserModel.create({
         name,
         email,
         password: bcrypt.hashSync(password, bcryptSalt),
      });
      res.json(userDoc);
   } catch (e) {
      res.status(422).json(e);
   }
});

app.post("/login", async (req, res) => {
   const { email, password } = req.body;

   const userDoc = await UserModel.findOne({ email });

   if (!userDoc) {
      return res.status(404).json({ error: "User not found" });
   }

   const passOk = bcrypt.compareSync(password, userDoc.password);
   if (!passOk) {
      return res.status(401).json({ error: "Invalid password" });
   }

   jwt.sign(
      {
         email: userDoc.email,
         id: userDoc._id,
      },
      jwtSecret,
      {},
      (err, token) => {
         if (err) {
            return res.status(500).json({ error: "Failed to generate token" });
         }
         res.cookie("token", token).json(userDoc);
      }
   );
});

app.get("/profile", (req, res) => {
   const { token } = req.cookies;
   if (token) {
      jwt.verify(token, jwtSecret, {}, async (err, userData) => {
         if (err) {
            // Handle error gracefully
            console.error("Error verifying token:", err);
            res.status(500).json({ error: "Internal server error" });
            return;
         }
         try {
            const { name, email, _id } = await UserModel.findById(userData.id);
            res.json({ name, email, _id });
         } catch (error) {
            console.error("Error fetching user data:", error);
            res.status(500).json({ error: "Internal server error" });
         }
      });
   } else {
      res.json(null);
   }
});

app.post("/logout", (req, res) => {
   res.cookie("token", "").json(true);
});

app.post("/createEvent", async (req, res) => {
   const eventData = req.body; // Extract all data from the request body

   try {
      // Create a new event object using the extracted data
      const newEvent = new Event({
         owner: eventData.owner,
         title: eventData.title,
         optional: eventData.optional,
         description: eventData.description,
         organizedBy: eventData.organizedBy,
         eventDate: eventData.eventDate,
         eventTime: eventData.eventTime,
         location: eventData.location,
         ticketPrice: eventData.ticketPrice,
         likes: eventData.likes,
         imageURL: eventData.imageURL // Include imageURL if it's in the request body
      });

      // Save the new event
      await newEvent.save();

      // Send the newly created event in the response
      res.status(201).json(newEvent);
   } catch (error) {
      console.error("Error creating new event:", error.message);
      res.status(500).json({ error: "Failed to save the event to MongoDB" });
   }
});



app.get("/createEvent", async (req, res) => {
   try {
      const events = await Event.find().sort({ eventDate: -1 });
      res.status(200).json(events);
   } catch (error) {
      console.error("Error fetching events:", error.message);
      res.status(500).json({ error: "Failed to fetch events from MongoDB" });
   }
});

app.get("/event/:id", async (req, res) => {
   const { id } = req.params;
   try {
      const event = await Event.findById(id);
      if (!event) {
         return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
   } catch (error) {
      console.error("Error fetching event:", error.message);
      res.status(500).json({ error: "Failed to fetch event from MongoDB" });
   }
});

app.post("/event/:eventId", (req, res) => {
   const eventId = req.params.eventId;

   Event.findById(eventId)
      .then((event) => {
         if (!event) {
            return res.status(404).json({ message: "Event not found" });
         }

         event.likes += 1;
         return event.save();
      })
      .then((updatedEvent) => {
         res.json(updatedEvent);
      })
      .catch((error) => {
         console.error("Error liking the event:", error.message);
         res.status(500).json({ message: "Server error" });
      });
});

app.get("/events", (req, res) => {
   Event.find().sort({ eventDate: -1 })
      .then((events) => {
         res.json(events);
      })
      .catch((error) => {
         console.error("Error fetching events:", error.message);
         res.status(500).json({ message: "Server error" });
      });
});

app.get("/event/:id/ordersummary", async (req, res) => {
   const { id } = req.params;
   try {
      const event = await Event.findById(id);
      if (!event) {
         return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
   } catch (error) {
      console.error("Error fetching event:", error.message);
      res.status(500).json({ error: "Failed to fetch event from MongoDB" });
   }
});

app.get("/event/:id/ordersummary/paymentsummary", async (req, res) => {
   const { id } = req.params;
   try {
      const event = await Event.findById(id);
      if (!event) {
         return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
   } catch (error) {
      console.error("Error fetching event:", error.message);
      res.status(500).json({ error: "Failed to fetch event from MongoDB" });
   }
});

app.post("/tickets", async (req, res) => {
   try {
      const ticketDetails = req.body;
      const newTicket = new Ticket(ticketDetails);
      const savedTicket = await newTicket.save();
      return res.status(201).json({ ticket: savedTicket });
   } catch (error) {
      console.error("Error creating ticket:", error.message);
      return res.status(500).json({ error: "Failed to create ticket" });
   }
});

app.get("/tickets/:id", async (req, res) => {
   try {
      const ticketId = req.params.id;
      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
         return res.status(404).json({ message: "Ticket not found" });
      }
      res.json(ticket);
   } catch (error) {
      console.error("Error fetching tickets:", error.message);
      res.status(500).json({ error: "Failed to fetch tickets" });
   }
});

app.get("/tickets/user/:userId", (req, res) => {
   const userId = req.params.userId;

   Ticket.find({ userid: userId })
      .then((tickets) => {
         res.json(tickets);
      })
      .catch((error) => {
         console.error("Error fetching user tickets:", error.message);
         res.status(500).json({ error: "Failed to fetch user tickets" });
      });
});

app.delete("/tickets/:id", async (req, res) => {
   try {
      const ticketId = req.params.id;
      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
         return res.status(404).json({ message: "Ticket not found" });
      }
      await Ticket.findByIdAndDelete(ticketId);
      res.status(204).send();
   } catch (error) {
      console.error("Error deleting ticket:", error.message);
      res.status(500).json({ error: "Failed to delete ticket" });
   }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
   console.log(`Server is running on port ${PORT}`);
});

