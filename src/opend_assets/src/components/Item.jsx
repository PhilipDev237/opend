import React, { useEffect, useState } from "react";
import logo from "../../assets/logo.png";
import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../../../declarations/nft";
import { idlFactory as tokenIdlFactory } from "../../../declarations/token";
import {Principal} from "@dfinity/principal";
import Button from "./Button";
import {opend} from "../../../declarations/opend";
import { nft } from "../../../declarations/nft/index";
import CURRENT_USER_ID from "../index";
import PriceLabel from "./PriceLabel";

function Item(props) {
  const [name, setName] = useState();
  const [owner, setOwner] = useState();
  const [image, setImage] = useState();
  const [button, setButton] = useState();
  const [priceInput, setPriceInput] = useState();
  const [loaderHidden, setLoaderHidden] = useState(true);
  const [blur, setBlur] = useState();
  const [sellStatus, setSellStatus] = useState("");
  const [priceLabel, setPriceLabel] = useState();
  const [shouldDisplay, setDisplay] = useState(true);

  const id = props.id;

  // access NFT canister using Http
  const localhost = "http://localhost:8080";
  const agent = new HttpAgent({host: localhost});

  // TODO: only works for local deployment
  // remove when going live
  agent.fetchRootKey();

  // calling NFT functions async
  // load NFT
  let NFTActor;
  async function loadNFT(){
    NFTActor = await Actor.createActor(idlFactory, {
      agent,
      canisterId: id,
    });

    // get nft name
    const name = await NFTActor.getName();
    setName(name);

    // get owner 
    const owner = await NFTActor.getOwner();
    setOwner(owner.toText());

    // get image data
    const imageData = await NFTActor.getAsset();
    const imageContent = new Uint8Array(imageData);
    const image = URL.createObjectURL(
      new Blob([imageContent.buffer], 
      {type: "image/png"
    }));

    setImage(image);

    if(props.role == "collection"){
      // we check if item is listed
      // and set up CSS
      const nftIsListed = await opend.isListed(id);

      if(nftIsListed){
        setOwner("OpenD");
        setBlur({filter: "blur(4px)"});
        setSellStatus("Listed");
      }else{
        // set button
        setButton(<Button handleClick={handleSell} text={"Sell"} />);
      }
    }else if (props.role == "discover") {
      const originalOwner = await opend.getOriginalOwner(id);

      // we verify if current user is nft owner
      if(originalOwner.toText() != CURRENT_USER_ID.toText()){
        setButton(<Button handleClick={handleBuy} text={"Buy"} />);
      }     
      
      // check the price of the NFT
      const price = await opend.getNFTPrice(id);
      setPriceLabel(<PriceLabel sellPrice={price.toString()} />);
    }   
  }

  // call NFT once
  useEffect(() => {
    loadNFT();
  }, []);

  // handle sell
  let price;

  function handleSell(){
    setPriceInput(
      <input
        placeholder="Price in UM"
        type="number"
        className="price-input"
        value={price}
        onChange={(e) => price = e.target.value}
      />
    );

    setButton(<Button handleClick={sellItem} text={"Confirm"} />);
  }

  // this function handles what happens
  // when the confirm button is clicked
  // The item is grabbed from the backend and
  // displayed for sale 
  async function sellItem(){
    setBlur({filter: "blur(4px)"}); // CSS blur
    setLoaderHidden(false);
    const listingResult = await opend.listItem(id, Number(price));
    
    if(listingResult == "Success"){
      const openDId = await opend.getOpendCanisterID();
      const transferResult = await NFTActor.transferOwnership(openDId);

      if(transferResult == "Success"){
        setLoaderHidden(true);
        setButton();
        setPriceInput();
        setOwner("OpenD");
        setSellStatus("Listed");
      }
    }
  }

  // handle what happens on the  discover page
  // when user clicks buy button
  async function handleBuy(){
    setLoaderHidden(false);
    const tokenActor = await Actor.createActor(tokenIdlFactory, {
      agent,
      canisterId: Principal.fromText("rrkah-fqaaa-aaaaa-aaaaq-cai"),
    });

    const sellerId = await opend.getOriginalOwner(id);
    const itemPrice = await opend.getNFTPrice(id);

    const result = await tokenActor.transfer(sellerId, itemPrice);
    if(result == "Success"){
      const transferResult = await opend.completePurchase(id, sellerId, CURRENT_USER_ID);
      console.log("purchase: " + transferResult);
      setLoaderHidden(true);
      setDisplay(false);
    }
  }

  return (
    <div style={{display: shouldDisplay ? "inline" : "none"}} className="disGrid-item">
      <div className="disPaper-root disCard-root makeStyles-root-17 disPaper-elevation1 disPaper-rounded">
        <img
          className="disCardMedia-root makeStyles-image-19 disCardMedia-media disCardMedia-img"
          src={image}
          style={blur}
        />
        <div className="lds-ellipsis" hidden={loaderHidden}>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
        <div className="disCardContent-root">
          {priceLabel}
          <h2 className="disTypography-root makeStyles-bodyText-24 disTypography-h5 disTypography-gutterBottom">
            {name}<span className="purple-text"> {sellStatus}</span>
          </h2>
          <p className="disTypography-root makeStyles-bodyText-24 disTypography-body2 disTypography-colorTextSecondary">
            Owner: {owner}
          </p>
          {priceInput}
          {button}
        </div>
      </div>
    </div>
  );
}

export default Item;
