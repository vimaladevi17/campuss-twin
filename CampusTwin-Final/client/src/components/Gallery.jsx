import React from "react";
import "./Gallery.css";

import campus1 from "../assets/gallery/campus1.jpg";
import campus2 from "../assets/gallery/campus2.jpg";
import campus3 from "../assets/gallery/campus3.jpg";
import campus4 from "../assets/gallery/campus4.jpg";
import campus5 from "../assets/gallery/campus5.jpg";
import campus6 from "../assets/gallery/campus6.jpg";

function Gallery() {

    const images=[
        {img:campus1,title:"Main Entrance"},
        {img:campus2,title:"Central Library"},
        {img:campus3,title:"Academic Block"},
        {img:campus4,title:"Computer Lab"},
        {img:campus5,title:"Auditorium"},
        {img:campus6,title:"Sports Ground"}
    ];

    return(

        <section className="gallery">

            <h2>Campus Gallery</h2>

            <div className="gallery-grid">

                {
                    images.map((item,index)=>(
                        <div className="gallery-card" key={index}>

                            <img src={item.img} alt={item.title}/>

                            <h3>{item.title}</h3>

                        </div>
                    ))
                }

            </div>

        </section>

    )

}

export default Gallery;